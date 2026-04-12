package com.caius.agent.module.agent.service;

import com.caius.agent.module.agent.dto.ChatRequest;
import com.caius.agent.module.agent.dto.ChatResponse;

/**
 * Agent 服务接口
 */
public interface AgentService {

    /**
     * 聊天对话
     */
    ChatResponse chat(ChatRequest request);
}
