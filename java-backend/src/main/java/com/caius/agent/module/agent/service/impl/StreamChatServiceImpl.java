package com.caius.agent.module.agent.service.impl;

import com.caius.agent.dao.ChunkMapper;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.dto.StreamChatRequest;
import com.caius.agent.module.agent.model.SseEvent;
import com.caius.agent.module.agent.service.StreamChatService;
import com.caius.agent.module.conversation.entity.Chunk;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.gateway.PythonAgentStreamGateway;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 流式聊天服务实现
 *
 * 核心职责：
 * 1. 调用 Python SSE 服务
 * 2. 逐条转发事件给前端（透传）
 * 3. 实现心跳机制（15秒）
 * 4. 处理 done / error 事件
 * 5. 存储 chunk 数据，多个 chunk 组装成 message
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StreamChatServiceImpl implements StreamChatService {

    private final PythonAgentStreamGateway streamGateway;
    private final ObjectMapper objectMapper;
    private final ChunkMapper chunkMapper;
    private final MessageMapper messageMapper;
    private final ConversationMapper conversationMapper;

    @Value("${python-agent.heartbeat-interval:15000}")
    private long heartbeatInterval;

    @Override
    public SseEmitter streamChat(Long userId, StreamChatRequest request) {
        // 超时时间 120 秒
        long timeout = 120000L;
        SseEmitter emitter = new SseEmitter(timeout);

        // 异步处理，不阻塞主线程
        CompletableFuture.runAsync(() -> handleStream(emitter, userId, request));

        // 处理完成事件
        emitter.onCompletion(() -> log.info("[流式服务] SSE 连接完成, userId={}", userId));

        // 处理超时事件
        emitter.onTimeout(() -> {
            log.warn("[流式服务] SSE 连接超时, userId={}", userId);
            sendError(emitter, "请求超时");
            emitter.complete();
        });

        // 处理异常事件
        emitter.onError((ex) -> log.error("[流式服务] SSE 连接异常, userId={}", userId, ex));

        return emitter;
    }

    /**
     * 处理流式请求
     */
    private void handleStream(SseEmitter emitter, Long userId, StreamChatRequest request) {
        log.info("[流式服务] 开始处理流式请求, userId={}, request={}", userId, request);

        // 获取或创建会话
        Long conversationId = getOrCreateConversation(userId, request);

        // 构建请求体
        Map<String, Object> requestBody = buildRequestBody(userId, request, conversationId);

        // 标记是否已完成
        AtomicBoolean completed = new AtomicBoolean(false);

        // Chunk 计数器
        AtomicInteger chunkIndex = new AtomicInteger(0);

        // 创建 Message 记录（用户消息）
        Message userMessage = createUserMessage(userId, conversationId, request.getMessage());

        try {
            // 获取 Python SSE 流
            Flux<SseEvent> eventFlux = streamGateway.streamChat(requestBody);

            // 创建心跳 Flux
            Flux<SseEvent> heartbeatFlux = Flux.interval(
                            java.time.Duration.ofMillis(heartbeatInterval),
                            java.time.Duration.ofMillis(heartbeatInterval)
                    )
                    .map(tick -> SseEvent.builder()
                            .event("ping")
                            .data("keep-alive")
                            .build())
                    .doOnNext(event -> log.debug("[流式服务] 发送心跳"));

            // 用于累积 assistant 回复内容
            StringBuilder assistantContent = new StringBuilder();
            String[] agentTitle = new String[1]; // 存储 agent 总结

            // 合并数据流和心跳流
            Flux.merge(eventFlux, heartbeatFlux)
                    .doOnNext(sseEvent -> {
                        if (completed.get()) {
                            return;
                        }

                        try {
                            // 记录日志
                            if ("done".equals(sseEvent.getEvent())) {
                                log.info("[流式服务] 收到完成事件: {}", sseEvent.getData());
                                
                                // 解析 done 事件数据，提取 agent 总结
                                String title = parseDoneEvent(sseEvent.getData());
                                agentTitle[0] = title;
                                
                                // 创建 Assistant Message
                                Message assistantMessage = createAssistantMessage(
                                        userId, conversationId, 
                                        assistantContent.toString(), 
                                        title
                                );

                                // 完成流式处理
                                completed.set(true);
                                emitter.complete();
                                log.info("[流式服务] 连接已完成, messageId={}, title={}", 
                                        assistantMessage.getId(), title);
                                
                            } else if ("error".equals(sseEvent.getEvent())) {
                                log.error("[流式服务] 收到错误事件: {}", sseEvent.getData());
                                completed.set(true);
                                sendError(emitter, "Python 服务返回错误");
                                emitter.complete();
                                
                            } else if ("ping".equals(sseEvent.getEvent())) {
                                // 心跳不打印详细日志
                                
                            } else {
                                log.debug("[流式服务] 收到事件: event={}, id={}, data={}",
                                        sseEvent.getEvent(), sseEvent.getId(), sseEvent.getData());

                                // 存储 Chunk（只存储 assistant 的内容）
                                // Python Agent 返回的事件类型可能是 "chunk", "message" 或 "content"
                                if ("chunk".equals(sseEvent.getEvent()) || 
                                    "message".equals(sseEvent.getEvent()) || 
                                    "content".equals(sseEvent.getEvent())) {
                                    String content = parseContentEvent(sseEvent.getData());
                                    if (content != null && !content.isEmpty()) {
                                        assistantContent.append(content);
                                        
                                        // 保存 chunk
                                        saveChunk(userId, conversationId, null, 
                                                "assistant", content, chunkIndex.getAndIncrement());
                                    }
                                }
                            }

                            // 发送事件给前端
                            sendEvent(emitter, sseEvent);

                        } catch (IOException e) {
                            log.error("[流式服务] 发送事件失败", e);
                            completed.set(true);
                            sendError(emitter, "发送数据失败");
                            emitter.completeWithError(e);
                        }
                    })
                    .doOnError(error -> {
                        if (!completed.get()) {
                            log.error("[流式服务] 流式处理异常", error);
                            completed.set(true);
                            sendError(emitter, "内部服务异常");
                            emitter.completeWithError(error);
                        }
                    })
                    .doOnComplete(() -> {
                        if (!completed.get()) {
                            log.info("[流式服务] 流式处理完成");
                            completed.set(true);
                            emitter.complete();
                        }
                    })
                    .subscribe();

        } catch (Exception e) {
            if (!completed.get()) {
                log.error("[流式服务] 流式处理异常", e);
                completed.set(true);
                sendError(emitter, "内部服务异常");
                emitter.completeWithError(e);
            }
        }
    }

    /**
     * 获取或创建会话
     */
    private Long getOrCreateConversation(Long userId, StreamChatRequest request) {
        Long conversationId = request.getConversationId();
        
        if (conversationId == null) {
            // 创建新会话
            Conversation conversation = new Conversation();
            conversation.setUserId(userId);
            conversation.setTitle(request.getMessage().substring(0, 
                    Math.min(50, request.getMessage().length())));
            conversation.setDeleted(0);
            conversation.setCreatedAt(LocalDateTime.now());
            conversation.setUpdatedAt(LocalDateTime.now());
            
            conversationMapper.insert(conversation);
            conversationId = conversation.getId();
            
            log.info("[流式服务] 创建新会话, conversationId={}", conversationId);
        }
        
        return conversationId;
    }

    /**
     * 创建用户消息
     */
    private Message createUserMessage(Long userId, Long conversationId, String content) {
        Message message = new Message();
        message.setConversationId(conversationId);
        message.setUserId(userId);
        message.setRole("user");
        message.setContent(content);
        message.setDeleted(0);
        message.setCreatedAt(LocalDateTime.now());
        message.setUpdatedAt(LocalDateTime.now());
        
        messageMapper.insert(message);
        log.debug("[流式服务] 创建用户消息, messageId={}", message.getId());
        
        return message;
    }

    /**
     * 创建 AI 助手消息（在 done 事件时调用）
     */
    private Message createAssistantMessage(Long userId, Long conversationId, 
                                           String content, String title) {
        Message message = new Message();
        message.setConversationId(conversationId);
        message.setUserId(userId);
        message.setRole("assistant");
        message.setContent(content);
        message.setTitle(title); // 存储 agent 总结
        message.setDeleted(0);
        message.setCreatedAt(LocalDateTime.now());
        message.setUpdatedAt(LocalDateTime.now());
        
        messageMapper.insert(message);
        
        // 更新所有 chunk 的 messageId
        chunkMapper.update(null, 
                new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<Chunk>()
                        .eq(Chunk::getConversationId, conversationId)
                        .isNull(Chunk::getMessageId)
                        .set(Chunk::getMessageId, message.getId())
        );
        
        log.info("[流式服务] 创建 AI 助手消息, messageId={}, chunkCount={}", 
                message.getId(), chunkMapper.selectCount(
                        new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Chunk>()
                                .eq(Chunk::getMessageId, message.getId())
                ));
        
        return message;
    }

    /**
     * 保存 chunk
     */
    private void saveChunk(Long userId, Long conversationId, Long messageId, 
                          String role, String content, int index) {
        Chunk chunk = new Chunk();
        chunk.setConversationId(conversationId);
        chunk.setMessageId(messageId); // 初始为 null，完成后更新
        chunk.setUserId(userId);
        chunk.setRole(role);
        chunk.setContent(content);
        chunk.setChunkIndex(index);
        chunk.setIsLast(false);
        chunk.setDeleted(0);
        chunk.setCreatedAt(LocalDateTime.now());
        chunk.setUpdatedAt(LocalDateTime.now());
        
        chunkMapper.insert(chunk);
        log.debug("[流式服务] 保存 chunk, chunkId={}, index={}", chunk.getId(), index);
    }

    /**
     * 解析 content 事件数据
     */
    private String parseContentEvent(String data) {
        try {
            JsonNode jsonNode = objectMapper.readTree(data);
            if (jsonNode.has("content")) {
                return jsonNode.get("content").asText();
            }
        } catch (Exception e) {
            // 如果不是 JSON 格式，直接返回数据
            return data;
        }
        return null;
    }

    /**
     * 解析 done 事件数据，提取 agent 总结
     */
    private String parseDoneEvent(String data) {
        try {
            JsonNode jsonNode = objectMapper.readTree(data);
            // 尝试从 done 事件中提取 title/summary/info 字段
            if (jsonNode.has("title")) {
                return jsonNode.get("title").asText();
            } else if (jsonNode.has("summary")) {
                return jsonNode.get("summary").asText();
            } else if (jsonNode.has("info")) {
                return jsonNode.get("info").asText();
            } else if (jsonNode.has("message")) {
                return jsonNode.get("message").asText();
            }
        } catch (Exception e) {
            log.warn("[流式服务] 解析 done 事件失败: {}", data);
        }
        return "对话完成";
    }

    /**
     * 发送 SSE 事件
     */
    private void sendEvent(SseEmitter emitter, SseEvent sseEvent) throws IOException {
        SseEmitter.SseEventBuilder eventBuilder = SseEmitter.event()
                .name(sseEvent.getEvent())
                .data(sseEvent.getData());

        if (sseEvent.getId() != null) {
            eventBuilder.id(sseEvent.getId());
        }

        emitter.send(eventBuilder);
    }

    /**
     * 发送错误事件
     */
    private void sendError(SseEmitter emitter, String message) {
        try {
            Map<String, Object> errorData = Map.of(
                    "type", "error",
                    "message", message
            );
            String json = objectMapper.writeValueAsString(errorData);

            SseEmitter.SseEventBuilder eventBuilder = SseEmitter.event()
                    .name("error")
                    .data(json);

            emitter.send(eventBuilder);
        } catch (Exception e) {
            log.error("[流式服务] 发送错误事件失败", e);
        }
    }

    /**
     * 构建请求体
     */
    private Map<String, Object> buildRequestBody(Long userId, StreamChatRequest request, 
                                                  Long conversationId) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", request.getMessage());

        if (request.getSessionId() != null) {
            body.put("session_id", request.getSessionId());
        }

        if (conversationId != null) {
            body.put("conversation_id", conversationId);
        }

        body.put("user_id", userId);
        body.put("stream", true);

        return body;
    }
}
