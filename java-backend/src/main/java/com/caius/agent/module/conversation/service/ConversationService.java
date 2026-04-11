package com.caius.agent.module.conversation.service;

import com.caius.agent.module.conversation.dto.ConversationDTO;
import com.caius.agent.module.conversation.dto.MessageDTO;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;

import java.util.List;

/**
 * 会话服务接口
 */
public interface ConversationService {

    /**
     * 获取用户会话列表（包含最新消息预览）
     */
    List<ConversationDTO> getConversations(Long userId);

    /**
     * 获取会话消息列表（包含用户信息）
     */
    List<MessageDTO> getMessages(Long conversationId, Long userId);

    /**
     * 删除会话
     */
    void deleteConversation(Long conversationId, Long userId);
}
