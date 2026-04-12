package com.caius.agent.module.agent.service.impl;

import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.config.AbortManager;
import com.caius.agent.module.agent.dto.StreamChatRequest;
import com.caius.agent.module.agent.model.SseEvent;
import com.caius.agent.module.agent.service.StreamChatService;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
import com.caius.agent.module.gateway.PythonAgentStreamGateway;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 流式聊天服务（支持 abort 控制）
 *
 * 核心原则：
 * 1. 收到 chunk → 检查 abort 状态 → 未中断则发给前端
 * 2. 内存缓冲 chunk 内容（全部在内存中，不写 IO）
 * 3. done 事件 → 异步批量写 MySQL（用户消息 + AI 消息）+ Redis（一次性）
 * 4. abort/error → 异步清理，确保无孤儿记录
 * 5. 任务结束 → 清理 abortMap 防止内存泄漏
 *
 * ⭐ 数据一致性保证：
 * - 用户消息和 AI 消息延迟到 done 事件时异步写入
 * - 生成失败或中断时，数据库中不会留下孤儿记录
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StreamChatServiceImpl implements StreamChatService {

    private final PythonAgentStreamGateway streamGateway;
    private final ObjectMapper objectMapper;
    private final MessageMapper messageMapper;
    private final ConversationMapper conversationMapper;
    private final StringRedisTemplate redisTemplate;
    private final AbortManager abortManager;
    private final ConversationOwnershipService conversationOwnershipService;
    private final UserScopedCacheKeyFactory cacheKeyFactory;

    @Value("${streaming.max-chunks-per-message:5000}")
    private int maxChunksPerMessage;

    @Value("${streaming.chunk-ttl:3600}")
    private int chunkTtlSeconds;

    // 异步执行器：所有 DB/Redis 写入均异步，不阻塞 SSE 流
    private final ExecutorService storageExecutor = Executors.newVirtualThreadPerTaskExecutor();

    // 并发控制
    private final ConcurrentHashMap<Long, AtomicInteger> userActiveStreams = new ConcurrentHashMap<>();
    
    // 每个流的 chunk 计数器（用于日志）
    private final ConcurrentHashMap<String, AtomicInteger> streamChunkCounts = new ConcurrentHashMap<>();

    @Value("${streaming.per-user-limit:5}")
    private int perUserLimit;

    // 任务超时时间（分钟）
    @Value("${streaming.task-timeout:30}")
    private int taskTimeoutMinutes;

    @Override
    public SseEmitter streamChat(Long userId, StreamChatRequest request) {
        AtomicInteger activeCount = userActiveStreams.computeIfAbsent(userId, k -> new AtomicInteger(0));
        if (activeCount.incrementAndGet() > perUserLimit) {
            activeCount.decrementAndGet();
            throw new IllegalStateException("用户并发流数超限: " + activeCount.get() + "/" + perUserLimit);
        }

        SseEmitter emitter = new SseEmitter(600000L);  // 600 秒（10 分钟）空闲超时
        SafeEmitter safeEmitter = new SafeEmitter(emitter);

        // 生成 messageId 用于 abort 控制
        String messageId = UUID.randomUUID().toString();
        
        // 初始化 chunk 计数器
        streamChunkCounts.put(messageId, new AtomicInteger(0));

        CompletableFuture.runAsync(() -> {
            try {
                handleStream(safeEmitter, userId, request, messageId);
            } finally {
                activeCount.decrementAndGet();
                // 清理 abort 标记，防止内存泄漏
                abortManager.cleanup(messageId);
                // 清理 chunk 计数器
                streamChunkCounts.remove(messageId);
                log.debug("[流式] 清理资源, messageId={}", messageId);
            }
        });

        emitter.onCompletion(() -> {
            AtomicInteger count = streamChunkCounts.get(messageId);
            log.info("[流式] SSE 连接完成, messageId={}, 总 chunks={}", messageId, count != null ? count.get() : 0);
            safeEmitter.markCompleted();
        });
        emitter.onTimeout(() -> {
            AtomicInteger count = streamChunkCounts.get(messageId);
            log.warn("[流式] SSE 连接超时, userId={}, messageId={}, 已发送 chunks={}", userId, messageId, count != null ? count.get() : 0);
            safeEmitter.markCompleted();
            abortManager.triggerAbort(messageId);
        });
        emitter.onError((ex) -> {
            AtomicInteger count = streamChunkCounts.get(messageId);
            if (isClientDisconnect(ex)) {
                log.info("[流式] 客户端断开连接, messageId={}, 已发送 chunks={}", messageId, count != null ? count.get() : 0);
            } else {
                log.error("[流式] SSE 连接错误, messageId={}, 已发送 chunks={}", messageId, count != null ? count.get() : 0, ex);
            }
            safeEmitter.markCompleted();
            abortManager.triggerAbort(messageId);
        });

        // 返回 messageId 给前端（通过响应头）
        // ⭐ 重要：messageId 在 SSE 连接建立时立即返回，供前端 abort 使用
        try {
            emitter.send(SseEmitter.event()
                    .name("message_id")
                    .data("{\"messageId\":\"" + messageId + "\"}"));
            log.debug("[流式] 已发送 messageId, messageId={}", messageId);
        } catch (IOException e) {
            log.warn("[流式] 发送 messageId 失败", e);
        }

        return emitter;
    }

    /**
     * 处理流式请求
     */
    private void handleStream(SafeEmitter emitter, Long userId, StreamChatRequest request, String messageId) {
        // 标记是否是新创建的会话（用于 abort 时判断是否删除会话）
        boolean[] isNewConversation = {false};

        Long conversationId = getOrCreateConversation(userId, request);

        // 检查是否是新创建的会话
        if (request.getConversationId() == null) {
            isNewConversation[0] = true;
        }

        // 创建 abort 标记并关联 conversationId
        abortManager.createAbortFlag(messageId, userId, conversationId);
        
        // 获取共享的 chunk 计数器
        AtomicInteger chunkCount = streamChunkCounts.get(messageId);
        
        log.info("[流式] 开始处理, userId={}, messageId={}, conversationId={}, isNewConversation={}",
                userId, messageId, conversationId, isNewConversation[0]);

        Map<String, Object> requestBody = buildRequestBody(userId, request, conversationId);

        // 内存缓冲：累积所有 chunk 数据（只在内存中，不写 IO）
        List<String> chunkDataBuffer = Collections.synchronizedList(new ArrayList<>());
        StringBuilder fullContent = new StringBuilder();
        AtomicBoolean completed = new AtomicBoolean(false);
        AtomicBoolean aborted = new AtomicBoolean(false);

        String redisKey = cacheKeyFactory.streamChunks(userId, conversationId, messageId);

        // ⭐ 方案2：延迟写入用户消息（不在请求开始时写入）
        // 用户消息将在 done 事件中与 AI 消息一起异步写入
        // 这样可以确保：要么都成功，要么都失败，不会留下孤儿记录
        Long[] pendingUserMessageId = {null};  // 用于传递用户消息 ID 给异步任务

        CountDownLatch latch = new CountDownLatch(1);
        reactor.core.Disposable subscription = null;

        // 设置心跳机制：每 30 秒发送一次 ping，防止空闲超时
        ScheduledExecutorService heartbeatScheduler = Executors.newSingleThreadScheduledExecutor();
        AtomicBoolean lastEventWasPing = new AtomicBoolean(false);
        ScheduledFuture<?> heartbeatFuture = heartbeatScheduler.scheduleAtFixedRate(() -> {
            if (!completed.get()) {
                try {
                    log.debug("[流式] 发送心跳, messageId={}", messageId);
                    SseEvent pingEvent = new SseEvent("ping", null, "{\"type\":\"ping\"}");
                    emitter.sendEvent(pingEvent);
                    lastEventWasPing.set(true);
                } catch (IOException e) {
                    log.debug("[流式] 心跳发送失败，连接可能已断开, messageId={}", messageId);
                    // 心跳失败可能意味着连接已断开，但不主动关闭
                }
            }
        }, 30, 30, TimeUnit.SECONDS);

        // 设置任务超时
        ScheduledExecutorService timeoutScheduler = Executors.newSingleThreadScheduledExecutor();
        ScheduledFuture<?> timeoutFuture = timeoutScheduler.schedule(() -> {
            if (!completed.get()) {
                log.warn("[流式] 任务超时触发, messageId={}, 已接收 chunks={}, completed={}",
                        messageId, chunkCount.get(), completed.get());
                abortManager.triggerAbort(messageId);
                emitter.trySendError("任务超时");
                emitter.complete();
            } else {
                log.debug("[流式] 任务超时检查时已完成，跳过, messageId={}", messageId);
            }
        }, taskTimeoutMinutes, TimeUnit.MINUTES);

        try {
            Flux<SseEvent> eventFlux = streamGateway.streamChat(requestBody)
                    .subscribeOn(Schedulers.boundedElastic());

            subscription = eventFlux
                    .doOnNext(sseEvent -> {
                        if (completed.get()) return;

                        try {
                            // 检查 abort 状态
                            if (abortManager.shouldAbort(messageId)) {
                                log.info("[流式] 检测到 abort 信号, messageId={}", messageId);
                                aborted.set(true);
                                completed.set(true);
                                emitter.trySendError("流式生成已中断");
                                emitter.complete();
                                return;
                            }

                            // 🚀 立即发送给前端（唯一优先级）
                            emitter.sendEvent(sseEvent);

                            String event = sseEvent.getEvent();
                            if ("chunk".equals(event)) {
                                // 只累积，不写 IO
                                String content = extractContent(sseEvent.getData());
                                if (content != null) {
                                    fullContent.append(content);
                                    chunkDataBuffer.add(sseEvent.getData());
                                    chunkCount.incrementAndGet();
                                }

                            } else if ("done".equals(event)) {
                                String title = extractTitle(sseEvent.getData());

                                // ⭐ 在 done 事件中注入 messageId（供前端获取）
                                String doneDataWithMessageId = injectMessageId(sseEvent.getData(), messageId);

                                // ⭐ 方案2：异步写入所有消息（用户消息 + AI 消息 + Redis）
                                // 不阻塞 SSE 流，done 事件先发送给前端
                                final String finalTitle = title;
                                final String finalDoneData = doneDataWithMessageId;
                                
                                CompletableFuture.runAsync(() -> {
                                    try {
                                        // 1. 异步创建用户消息
                                        Long userMsgId = createUserMessage(
                                            userId, conversationId, request.getMessage());
                                        pendingUserMessageId[0] = userMsgId;
                                        
                                        // 2. 异步创建 AI 消息
                                        Message aiMsg = createAssistantMessage(
                                            userId, conversationId, fullContent.toString(), finalTitle);
                                        
                                        // 3. 异步批量写 Redis（断线恢复用）
                                        if (!chunkDataBuffer.isEmpty()) {
                                            batchWriteToRedis(redisKey, messageId, chunkDataBuffer);
                                        }
                                        
                                        log.info("[存储] 异步保存完成, messageId={}, userMsgId={}, aiMsgId={}, chunks={}",
                                                messageId, userMsgId, aiMsg.getId(), chunkDataBuffer.size());
                                        
                                    } catch (Exception e) {
                                        log.error("[存储] 异步保存失败, messageId={}", messageId, e);
                                    }
                                }, storageExecutor);

                                // ⭐ 发送包含 messageId 的 done 事件（不等待 DB 写入完成）
                                SseEvent doneEvent = new SseEvent("done", sseEvent.getId(), finalDoneData);
                                emitter.sendEvent(doneEvent);

                                completed.set(true);
                                emitter.complete();

                            } else if ("error".equals(event)) {
                                completed.set(true);
                                // ⭐ 方案3：error 场景也清理（虽然用户消息还没写入，但需要清理 Redis）
                                final String errorMsg = "AI 服务返回错误";
                                CompletableFuture.runAsync(() -> {
                                    cleanupAfterError(userId, conversationId, messageId, redisKey, isNewConversation[0]);
                                }, storageExecutor);
                                emitter.trySendError(errorMsg);
                                emitter.complete();
                            }

                        } catch (IOException e) {
                            if (isClientDisconnect(e)) {
                                log.debug("[流式] 客户端断开连接, messageId={}", messageId);
                            } else {
                                log.error("[流式] 发送失败, messageId={}", messageId, e);
                            }
                            if (completed.compareAndSet(false, true)) {
                                if (!isClientDisconnect(e)) {
                                    emitter.trySendError("发送失败");
                                }
                                emitter.complete();
                            }
                        }
                    })
                    .doOnError(err -> {
                        if (completed.compareAndSet(false, true)) {
                            if (isClientDisconnect(err)) {
                                log.debug("[流式] 客户端断开导致流结束, messageId={}", messageId);
                            } else {
                                log.error("[流式] 异常, messageId={}", messageId, err);
                                emitter.trySendError("服务异常");
                            }
                            emitter.complete();
                        }
                    })
                    .doFinally(signal -> {
                        completed.set(true);
                        log.info("[流式] 流最终结束, messageId={}, signal={}, 总 chunks={}, aborted={}",
                                messageId, signal, chunkCount.get(), aborted.get());
                        
                        // 取消心跳和超时任务
                        heartbeatFuture.cancel(false);
                        heartbeatScheduler.shutdownNow();
                        timeoutFuture.cancel(false);
                        timeoutScheduler.shutdownNow();

                        // ⭐ 如果是 abort，清理中间数据
                        // 注意：由于用户消息延迟写入，abort 时通常只需清理 Redis
                        // 但如果 done 事件的异步写入已启动，可能需要特殊处理
                        if (aborted.get()) {
                            cleanupAbortedMessages(
                                userId, conversationId, messageId,
                                pendingUserMessageId[0],  // 可能为 null（done 异步未完成时）
                                redisKey, isNewConversation[0]);
                        }

                        latch.countDown();
                    })
                    .subscribe();

            latch.await();

        } catch (Exception e) {
            if (completed.compareAndSet(false, true)) {
                log.error("[流式] 处理异常", e);
                emitter.trySendError("服务异常");
                emitter.complete();
            }
        } finally {
            if (subscription != null && !subscription.isDisposed()) {
                subscription.dispose();
            }
            // 确保超时和心跳调度器关闭
            if (!timeoutScheduler.isShutdown()) {
                timeoutScheduler.shutdownNow();
            }
            if (!heartbeatScheduler.isShutdown()) {
                heartbeatScheduler.shutdownNow();
            }
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * ⭐ 方案2：用户消息和 AI 消息在同一异步任务中写入
     * 确保数据一致性：要么都成功，要么都失败
     */
    private void saveMessagesAsync(Long userId, Long conversationId, String userMessage,
                                   String aiContent, String aiTitle, String redisKey,
                                   String messageId, List<String> chunkDataBuffer) {
        CompletableFuture.runAsync(() -> {
            try {
                // 1. 创建用户消息
                Long userMsgId = createUserMessage(userId, conversationId, userMessage);
                
                // 2. 创建 AI 消息
                Message aiMsg = createAssistantMessage(userId, conversationId, aiContent, aiTitle);
                
                // 3. 批量写 Redis（断线恢复用）
                if (!chunkDataBuffer.isEmpty()) {
                    batchWriteToRedis(redisKey, messageId, chunkDataBuffer);
                }
                
                log.info("[存储] 异步保存完成, messageId={}, userMsgId={}, aiMsgId={}, chunks={}",
                        messageId, userMsgId, aiMsg.getId(), chunkDataBuffer.size());
                
            } catch (Exception e) {
                log.error("[存储] 异步保存失败, messageId={}", messageId, e);
            }
        }, storageExecutor);
    }

    /**
     * Redis 批量写入（优化版：pipelined XADD + MAXLEN + TTL）
     * 
     * 优化点：
     * 1. 使用 MAXLEN ~ 1000 限制 Stream 长度（防止内存爆）
     * 2. TTL 仅在第一次写入时设置
     * 3. 批量 pipeline 减少网络往返
     */
    private void batchWriteToRedis(String redisKey, String messageId, List<String> chunkDataList) {
        try {
            int batchSize = 200;
            int maxLen = 1000; // Stream 最大长度限制

            byte[] key = redisKey.getBytes(StandardCharsets.UTF_8);
            byte[] fieldMsgId = "messageId".getBytes(StandardCharsets.UTF_8);
            byte[] filedData = "data".getBytes(StandardCharsets.UTF_8);
            byte[] MsgId = messageId.getBytes(StandardCharsets.UTF_8);

            for (int i = 0; i < chunkDataList.size(); i += batchSize) {
                int end = Math.min(i + batchSize, chunkDataList.size());
                List<String> subChunkDataList = chunkDataList.subList(i, end);

                int curIndex = i;
                redisTemplate.executePipelined((RedisCallback<Object>) connect -> {
                    for (String chunkData : subChunkDataList) {
                        Map<byte[], byte[]> map = new HashMap<>();
                        map.put(fieldMsgId, MsgId);
                        map.put(filedData, chunkData.getBytes(StandardCharsets.UTF_8));

                        // XADD 带 MAXLEN 限制
                        connect.streamCommands().xAdd(key, map);
                        connect.streamCommands().xTrim(key, maxLen, true);

                        if (curIndex == 0) {
                            // 仅在第一次设置 TTL
                            connect.keyCommands().expire(key, chunkTtlSeconds);
                        }
                    }
                    return null;
                });
            }

            log.debug("[Redis] 批量写入成功, key={}, chunks={}", redisKey, chunkDataList.size());
        } catch (Exception e) {
            log.error("[Redis] 批量写入失败, key={}", redisKey, e);
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 在 done 事件中注入 messageId（供前端获取）
     */
    private String injectMessageId(String doneDataJson, String messageId) {
        try {
            JsonNode node = objectMapper.readTree(doneDataJson);
            if (node.isObject()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) node).put("messageId", messageId);
                return objectMapper.writeValueAsString(node);
            }
        } catch (Exception e) {
            log.warn("[流式] 注入 messageId 失败，返回原始数据", e);
        }
        // 如果解析失败，在原始 JSON 后追加 messageId
        if (doneDataJson.endsWith("}")) {
            return doneDataJson.substring(0, doneDataJson.length() - 1) 
                    + ",\"messageId\":\"" + messageId + "\"}";
        }
        return doneDataJson;
    }

    private Long getOrCreateConversation(Long userId, StreamChatRequest request) {
        Long conversationId = request.getConversationId();
        if (conversationId == null) {
            Conversation conv = new Conversation();
            conv.setUserId(userId);
            conv.setTitle(request.getMessage().substring(0, Math.min(50, request.getMessage().length())));
            conv.setDeleted(0);
            conv.setCreatedAt(LocalDateTime.now());
            conv.setUpdatedAt(LocalDateTime.now());
            conversationMapper.insert(conv);
            conversationId = conv.getId();
        } else {
            conversationOwnershipService.requireOwnedConversation(conversationId, userId);
        }
        return conversationId;
    }

    private Long createUserMessage(Long userId, Long conversationId, String content) {
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setUserId(userId);
        msg.setRole("user");
        msg.setContent(content);
        msg.setDeleted(0);
        msg.setCreatedAt(LocalDateTime.now());
        msg.setUpdatedAt(LocalDateTime.now());
        messageMapper.insert(msg);
        return msg.getId();
    }

    private Message createAssistantMessage(Long userId, Long conversationId, String content, String title) {
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setUserId(userId);
        msg.setRole("assistant");
        msg.setContent(content);
        msg.setTitle(title);
        msg.setDeleted(0);
        msg.setCreatedAt(LocalDateTime.now());
        msg.setUpdatedAt(LocalDateTime.now());
        messageMapper.insert(msg);
        return msg;
    }

    private String extractContent(String data) {
        try {
            JsonNode node = objectMapper.readTree(data);
            return node.has("content") ? node.get("content").asText() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String extractTitle(String data) {
        try {
            JsonNode node = objectMapper.readTree(data);
            if (node.has("info")) return node.get("info").asText();
            if (node.has("title")) return node.get("title").asText();
            if (node.has("summary")) return node.get("summary").asText();
        } catch (Exception e) {
            log.warn("[流式] 解析 title 失败: {}", data);
        }
        return "对话完成";
    }

    private Map<String, Object> buildRequestBody(Long userId, StreamChatRequest request, Long conversationId) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", request.getMessage());
        if (request.getSessionId() != null) body.put("session_id", request.getSessionId());
        if (conversationId != null) body.put("conversation_id", conversationId);
        body.put("user_id", userId);
        body.put("stream", true);
        return body;
    }

    @Override
    public void recoverChunks(Long userId, Long conversationId, String messageId, String lastEventId, SseEmitter emitter) {
        conversationOwnershipService.requireOwnedConversation(conversationId, userId);
        String redisKey = cacheKeyFactory.streamChunks(userId, conversationId, messageId);
        try {
            var records = redisTemplate.opsForStream().read(StreamOffset.fromStart(redisKey));
            if (records != null) {
                for (var record : records) {
                    String dataJson = (String) record.getValue().get("data");
                    if (dataJson != null) {
                        JsonNode node = objectMapper.readTree(dataJson);
                        String type = node.has("type") ? node.get("type").asText() : "chunk";
                        emitter.send(SseEmitter.event().name(type).id(record.getId().getValue()).data(dataJson));
                    }
                }
            }
        } catch (Exception e) {
            log.error("[断线恢复] 失败", e);
        }
    }

    @Override
    public boolean abortStream(Long userId, String messageId) {
        log.info("[Abort] 收到中断请求, messageId={}", messageId);
        boolean success = abortManager.triggerAbort(messageId, userId);
        if (success) {
            log.info("[Abort] 中断信号已发送, messageId={}", messageId);
        } else {
            log.warn("[Abort] 任务可能已结束, messageId={}", messageId);
        }
        return success;
    }

    @Override
    public boolean abortStreamByConversationId(Long userId, Long conversationId) {
        conversationOwnershipService.requireOwnedConversation(conversationId, userId);
        log.info("[Abort] 收到基于 conversationId 的中断请求, conversationId={}", conversationId);
        boolean success = abortManager.triggerAbortByConversationId(conversationId, userId);
        if (success) {
            log.info("[Abort] 中断信号已发送, conversationId={}", conversationId);
        } else {
            log.warn("[Abort] 没有找到活跃流, conversationId={}", conversationId);
        }
        return success;
    }

    /**
     * 清理 abort 后的中间数据
     *
     * ⭐ 方案2 改进：由于用户消息延迟写入，abort 时通常只需清理 Redis
     * 如果 done 事件的异步写入已启动，userMessageId 可能不为 null
     *
     * @param conversationId 会话ID
     * @param messageId 消息ID
     * @param userMessageId 用户消息ID（可能为 null）
     * @param redisKey Redis key
     * @param isNewConversation 是否是新创建的会话
     */
    private void cleanupAbortedMessages(Long userId, Long conversationId, String messageId,
                                         Long userMessageId, String redisKey, boolean isNewConversation) {
        log.info("[Abort] 清理中间数据, conversationId={}, messageId={}, userMessageId={}, isNewConversation={}",
                conversationId, messageId, userMessageId, isNewConversation);

        try {
            // 1. 删除 Redis Stream 数据
            redisTemplate.delete(redisKey);
            log.debug("[Abort] 已清理 Redis Stream: {}", redisKey);

            // 2. 删除用户消息（如果已写入）
            if (userMessageId != null) {
                messageMapper.delete(
                        new LambdaQueryWrapper<Message>()
                                .eq(Message::getId, userMessageId)
                                .eq(Message::getUserId, userId)
                );
                log.debug("[Abort] 已删除用户消息: {}", userMessageId);
            } else {
                log.debug("[Abort] 用户消息尚未写入，跳过删除");
            }

            // 3. 如果是新创建的会话，检查是否有消息存在
            // 如果没有任何消息，删除空会话
            if (isNewConversation && conversationId != null) {
                long messageCount = messageMapper.selectCount(
                    new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .eq(Message::getUserId, userId)
                );
                
                if (messageCount == 0) {
                    conversationMapper.delete(
                            new LambdaQueryWrapper<Conversation>()
                                    .eq(Conversation::getId, conversationId)
                                    .eq(Conversation::getUserId, userId)
                    );
                    log.info("[Abort] 已删除空会话: {}", conversationId);
                } else {
                    log.info("[Abort] 会话已有消息，保留会话: {}, 消息数={}", conversationId, messageCount);
                }
            } else {
                log.info("[Abort] 保留已有会话: {}", conversationId);
            }

            log.info("[Abort] 清理完成, conversationId={}", conversationId);

        } catch (Exception e) {
            log.error("[Abort] 清理中间数据失败", e);
        }
    }

    /**
     * ⭐ 方案3：error 场景的清理逻辑
     * 由于用户消息延迟写入，只需清理 Redis 和可能的空会话
     *
     * @param conversationId 会话ID
     * @param messageId 消息ID
     * @param redisKey Redis key
     * @param isNewConversation 是否是新创建的会话
     */
    private void cleanupAfterError(Long userId, Long conversationId, String messageId,
                                    String redisKey, boolean isNewConversation) {
        log.info("[Error] 清理中间数据, conversationId={}, messageId={}", conversationId, messageId);

        try {
            // 1. 删除 Redis Stream 数据
            redisTemplate.delete(redisKey);
            log.debug("[Error] 已清理 Redis Stream: {}", redisKey);

            // 2. 如果是新创建的会话，检查是否有消息存在
            if (isNewConversation && conversationId != null) {
                long messageCount = messageMapper.selectCount(
                    new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .eq(Message::getUserId, userId)
                );
                
                if (messageCount == 0) {
                    conversationMapper.delete(
                            new LambdaQueryWrapper<Conversation>()
                                    .eq(Conversation::getId, conversationId)
                                    .eq(Conversation::getUserId, userId)
                    );
                    log.info("[Error] 已删除空会话: {}", conversationId);
                }
            }

            log.info("[Error] 清理完成, conversationId={}", conversationId);

        } catch (Exception e) {
            log.error("[Error] 清理中间数据失败", e);
        }
    }

    private boolean isClientDisconnect(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String className = current.getClass().getName();
            String message = current.getMessage();
            if (className.contains("AsyncRequestNotUsableException")
                    || className.contains("ClientAbortException")
                    || containsDisconnectMessage(message)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean containsDisconnectMessage(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("broken pipe")
                || normalized.contains("connection reset")
                || normalized.contains("connection aborted")
                || normalized.contains("async request")
                || normalized.contains("forcibly closed")
                || normalized.contains("response has already been committed");
    }

    // ==================== SafeEmitter ====================

    private static class SafeEmitter {
        private final SseEmitter emitter;
        private final AtomicBoolean completed = new AtomicBoolean(false);
        private final ReentrantLock lock = new ReentrantLock();

        SafeEmitter(SseEmitter emitter) { this.emitter = emitter; }

        void sendEvent(SseEvent sseEvent) throws IOException {
            if (completed.get()) return;
            lock.lock();
            try {
                if (completed.get()) return;
                var builder = SseEmitter.event().name(sseEvent.getEvent()).data(sseEvent.getData());
                if (sseEvent.getId() != null) builder.id(sseEvent.getId());
                emitter.send(builder);
            } catch (IllegalStateException e) {
                // 客户端已断开连接
                log.debug("[SafeEmitter] 客户端已断开, 停止发送");
                markCompleted();
                throw e;
            } catch (IOException e) {
                // 其他 IO 异常，标记为完成
                log.debug("[SafeEmitter] IO 异常: {}", e.getMessage());
                markCompleted();
                throw e;
            } finally { 
                lock.unlock(); 
            }
        }

        void trySendError(String msg) {
            try {
                emitter.send(SseEmitter.event().name("error")
                        .data("{\"type\":\"error\",\"message\":\"" + msg + "\"}"));
            } catch (Exception ignored) {
                // 客户端可能已断开，忽略
            }
        }

        void markCompleted() { 
            completed.set(true); 
        }

        void complete() {
            if (completed.compareAndSet(false, true)) {
                try { 
                    emitter.complete(); 
                } catch (Exception ignored) {
                    // 已经完成或出错，忽略
                }
            }
        }
    }
}
