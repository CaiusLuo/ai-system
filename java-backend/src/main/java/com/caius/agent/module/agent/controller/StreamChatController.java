package com.caius.agent.module.agent.controller;

import com.caius.agent.common.result.Result;
import com.caius.agent.module.agent.dto.AbortRequest;
import com.caius.agent.module.agent.dto.StreamChatRequest;
import com.caius.agent.module.agent.service.StreamChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Agent 流式控制器（生产级）
 *
 * 新增：断线恢复接口 + abort 中断接口
 */
@Slf4j
@RestController
@RequestMapping("/agent")
@RequiredArgsConstructor
public class StreamChatController {

    private final StreamChatService streamChatService;

    /**
     * 流式对话接口
     * 
     * 注意：messageId 由后端生成，前端需要从首次 SSE 事件中获取
     * 或者通过其他方式获取（后续可在 done 事件中返回）
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@Valid @RequestBody StreamChatRequest request) {
        log.info("[流式接口] 收到流式请求, message={}", request.getMessage());
        return streamChatService.streamChat(request);
    }

    /**
     * 中断流式生成（RESTful 风格）
     * 
     * 使用方式：
     * POST /api/v1/chat/{conversation_id}/abort
     * 
     * 注意：这个接口会中断该 conversation 下最新的活跃流
     * 
     * @param conversationId 会话 ID
     * @return 中断结果
     */
    @PostMapping(value = "/api/v1/chat/{conversationId}/abort")
    public Result<Boolean> abortByConversationId(@PathVariable Long conversationId) {
        log.info("[Abort] 收到基于 conversationId 的中断请求, conversationId={}", conversationId);
        boolean success = streamChatService.abortStreamByConversationId(conversationId);
        return Result.success(success);
    }

    /**
     * 中断流式生成（推荐接口）
     * 
     * 使用方式：
     * POST /agent/chat/stream/abort
     * Body: { "messageId": "xxx" }
     * 
     * @param request 包含 messageId 的请求体
     * @return 中断结果
     */
    @PostMapping("/chat/stream/abort")
    public Result<Boolean> abortStream(@RequestBody AbortRequest request) {
        String messageId = request.getMessageId();
        if (messageId == null || messageId.isBlank()) {
            log.warn("[Abort] messageId 为空");
            return Result.error("messageId 不能为空");
        }

        log.info("[Abort] 收到中断请求, messageId={}", messageId);
        boolean success = streamChatService.abortStream(messageId);
        return Result.success(success);
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
