package com.caius.agent.module.agent.controller;

import com.caius.agent.module.agent.dto.StreamChatRequest;
import com.caius.agent.module.agent.service.StreamChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Agent 流式控制器
 *
 * 职责：接收前端流式请求，透传 Python SSE 数据
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
     * 前端使用 EventSource 接收：
     * const evtSource = new EventSource('/agent/chat/stream');
     *
     * @param userId  用户 ID（从 Security Context 获取）
     * @param request 请求参数
     * @return SSE 发射器
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@AuthenticationPrincipal Long userId,
                                 @Valid @RequestBody StreamChatRequest request) {
        log.info("[流式接口] 收到流式请求, userId={}, message={}", userId, request.getMessage());

        return streamChatService.streamChat(userId, request);
    }
}
