package com.caius.agent.module.agent.service;

import com.caius.agent.module.agent.dto.StreamChatRequest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 流式聊天服务接口
 */
public interface StreamChatService {

    /**
     * 流式对话
     *
     * @param userId 用户 ID
     * @param request 请求参数
     * @return SSE 发射器
     */
    SseEmitter streamChat(Long userId, StreamChatRequest request);
}
