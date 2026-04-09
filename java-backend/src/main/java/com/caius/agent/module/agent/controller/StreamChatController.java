package com.caius.agent.module.agent.controller;

import com.caius.agent.module.agent.service.StreamChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Agent 流式控制器（生产级）
 *
 * 新增：断线恢复接口
 */
@Slf4j
@RestController
@RequestMapping("/agent")
@RequiredArgsConstructor
public class StreamChatController {

    private final StreamChatService streamChatService;

    /**
     * 流式对话接口
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@AuthenticationPrincipal Long userId,
                                 @Valid @RequestBody com.caius.agent.module.agent.dto.StreamChatRequest request) {
        log.info("[流式接口] 收到流式请求, userId={}, message={}", userId, request.getMessage());
        return streamChatService.streamChat(userId, request);
    }

    /**
     * 断线恢复接口
     *
     * 使用方式：
     * GET /agent/chat/stream/recover?conversationId=123&messageId=xxx&lastEventId=xxx
     *
     * @param conversationId 会话 ID
     * @param messageId      消息 ID（UUID）
     * @param lastEventId    最后接收到的事件 ID（可选）
     */
    @GetMapping(value = "/chat/stream/recover", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter recoverStream(
            @RequestParam Long conversationId,
            @RequestParam String messageId,
            @RequestParam(required = false) String lastEventId) {

        log.info("[断线恢复] 收到恢复请求, conversationId={}, messageId={}, lastEventId={}",
                conversationId, messageId, lastEventId);

        SseEmitter emitter = new SseEmitter(60000L); // 恢复超时 60 秒

        try {
            // 从 Redis 读取并 replay chunk
            streamChatService.recoverChunks(conversationId, messageId, lastEventId, emitter);
            emitter.complete();
        } catch (Exception e) {
            log.error("[断线恢复] 恢复失败", e);
            emitter.completeWithError(e);
        }

        return emitter;
    }
}
