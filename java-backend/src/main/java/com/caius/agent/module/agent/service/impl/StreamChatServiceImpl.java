package com.caius.agent.module.agent.service.impl;

import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.dto.StreamChatRequest;
import com.caius.agent.module.agent.model.SseEvent;
import com.caius.agent.module.agent.service.StreamChatService;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.gateway.PythonAgentStreamGateway;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 流式聊天服务（极简透传版）
 *
 * 核心原则：
 * 1. 收到 chunk → 立即发给前端（唯一优先级）
 * 2. 内存缓冲 chunk 内容
 * 3. done 事件 → 批量写 Redis + 写 MySQL（一次性）
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

    @Value("${streaming.max-chunks-per-message:5000}")
    private int maxChunksPerMessage;

    @Value("${streaming.chunk-ttl:3600}")
    private int chunkTtlSeconds;

    // 异步执行器：仅用于 done 事件的批量存储
    private final ExecutorService storageExecutor = Executors.newVirtualThreadPerTaskExecutor();

    // 并发控制
    private final ConcurrentHashMap<Long, AtomicInteger> userActiveStreams = new ConcurrentHashMap<>();

    @Value("${streaming.per-user-limit:5}")
    private int perUserLimit;

    @Override
    public SseEmitter streamChat(Long userId, StreamChatRequest request) {
        AtomicInteger activeCount = userActiveStreams.computeIfAbsent(userId, k -> new AtomicInteger(0));
        if (activeCount.incrementAndGet() > perUserLimit) {
            activeCount.decrementAndGet();
            throw new IllegalStateException("用户并发流数超限: " + activeCount.get() + "/" + perUserLimit);
        }

        SseEmitter emitter = new SseEmitter(120000L);
        SafeEmitter safeEmitter = new SafeEmitter(emitter);

        CompletableFuture.runAsync(() -> {
            try {
                handleStream(safeEmitter, userId, request);
            } finally {
                activeCount.decrementAndGet();
            }
        });

        emitter.onCompletion(() -> safeEmitter.markCompleted());
        emitter.onTimeout(() -> {
            log.warn("[流式] SSE 超时, userId={}", userId);
            safeEmitter.markCompleted();
        });
        emitter.onError((ex) -> safeEmitter.markCompleted());

        return emitter;
    }

    /**
     * 处理流式请求
     */
    private void handleStream(SafeEmitter emitter, Long userId, StreamChatRequest request) {
        Long conversationId = getOrCreateConversation(userId, request);
        Map<String, Object> requestBody = buildRequestBody(userId, request, conversationId);

        // 内存缓冲：累积所有 chunk 数据
        List<String> chunkDataBuffer = Collections.synchronizedList(new ArrayList<>());
        StringBuilder fullContent = new StringBuilder();
        AtomicInteger chunkCount = new AtomicInteger(0);
        AtomicBoolean completed = new AtomicBoolean(false);

        String messageId = UUID.randomUUID().toString();
        String redisKey = "stream:" + conversationId + ":" + messageId;

        // 创建用户消息
        createUserMessage(userId, conversationId, request.getMessage());

        CountDownLatch latch = new CountDownLatch(1);
        reactor.core.Disposable subscription = null;

        try {
            Flux<SseEvent> eventFlux = streamGateway.streamChat(requestBody)
                    .subscribeOn(Schedulers.boundedElastic());

            subscription = eventFlux
                    .doOnNext(sseEvent -> {
                        if (completed.get()) return;

                        try {
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

                                // 创建 Message
                                Message msg = createAssistantMessage(
                                        userId, conversationId, fullContent.toString(), title);

                                // 💾 一次性批量存储（异步，不阻塞）
                                batchSaveChunksAsync(chunkDataBuffer, conversationId, msg.getId(),
                                        redisKey, messageId);

                                completed.set(true);
                                emitter.complete();

                            } else if ("error".equals(event)) {
                                completed.set(true);
                                emitter.trySendError("AI 服务返回错误");
                                emitter.complete();
                            }

                        } catch (IOException e) {
                            log.error("[流式] 发送失败", e);
                            if (completed.compareAndSet(false, true)) {
                                emitter.trySendError("发送失败");
                                emitter.complete();
                            }
                        }
                    })
                    .doOnError(err -> {
                        if (completed.compareAndSet(false, true)) {
                            log.error("[流式] 异常: {}", err.getMessage());
                            emitter.trySendError("服务异常");
                            emitter.complete();
                        }
                    })
                    .doFinally(signal -> {
                        completed.set(true);
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
        }
    }

    /**
     * 批量保存 chunk（一次性操作）
     * 1. 批量写 Redis（Pipeline）
     * 2. 写 MySQL（Message 已在 done 事件中创建，这里不存 chunk 表）
     */
    private void batchSaveChunksAsync(List<String> chunkDataBuffer, Long conversationId,
                                       Long messageId, String redisKey, String streamMessageId) {
        if (chunkDataBuffer.isEmpty()) return;

        CompletableFuture.runAsync(() -> {
            try {
                // 1. 批量写 Redis（Pipeline，一次网络请求）
                batchWriteToRedis(redisKey, streamMessageId, chunkDataBuffer);

                log.info("[存储] 完成, messageId={}, chunks={}", messageId, chunkDataBuffer.size());

            } catch (Exception e) {
                log.error("[存储] 失败, messageId={}", messageId, e);
            }
        }, storageExecutor);
    }

    /**
     * Redis 批量写入（简化版：循环 XADD，设置一次 TTL）
     */
    private void batchWriteToRedis(String redisKey, String messageId, List<String> chunkDataList) {
        try {
            for (String chunkData : chunkDataList) {
                redisTemplate.opsForStream().add(
                        StreamRecords.newRecord()
                                .ofMap(Map.of(
                                        "messageId", messageId,
                                        "data", chunkData
                                ))
                                .withStreamKey(redisKey)
                );
            }
            redisTemplate.expire(redisKey, Duration.ofSeconds(chunkTtlSeconds));
        } catch (Exception e) {
            log.error("[Redis] 批量写入失败, key={}", redisKey, e);
        }
    }

    // ==================== 辅助方法 ====================

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
        }
        return conversationId;
    }

    private void createUserMessage(Long userId, Long conversationId, String content) {
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setUserId(userId);
        msg.setRole("user");
        msg.setContent(content);
        msg.setDeleted(0);
        msg.setCreatedAt(LocalDateTime.now());
        msg.setUpdatedAt(LocalDateTime.now());
        messageMapper.insert(msg);
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
    public void recoverChunks(Long conversationId, String messageId, String lastEventId, SseEmitter emitter) {
        String redisKey = "stream:" + conversationId + ":" + messageId;
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
                log.debug("[SafeEmitter] 已关闭");
            } finally { lock.unlock(); }
        }

        void trySendError(String msg) {
            try {
                emitter.send(SseEmitter.event().name("error")
                        .data("{\"type\":\"error\",\"message\":\"" + msg + "\"}"));
            } catch (Exception ignored) {}
        }

        void markCompleted() { completed.set(true); }
        void complete() {
            if (completed.compareAndSet(false, true)) {
                try { emitter.complete(); } catch (Exception ignored) {}
            }
        }
    }
}
