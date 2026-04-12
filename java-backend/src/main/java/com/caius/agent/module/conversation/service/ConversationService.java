package com.caius.agent.module.conversation.service;

import com.caius.agent.module.conversation.dto.ConversationDTO;
import com.caius.agent.module.conversation.dto.MessageDTO;
import java.util.List;

/**
 * 会话服务接口
 */
public interface ConversationService {

    /**
     * 获取用户会话列表（包含最新消息预览）
     */
    List<ConversationDTO> getConversations();

    /**
     * 获取会话消息列表（包含用户信息）
     */
    List<MessageDTO> getMessages(Long conversationId);

    /**
     * 删除会话
     */
    void deleteConversation(Long conversationId);
}
