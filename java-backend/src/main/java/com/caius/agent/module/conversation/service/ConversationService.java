package com.caius.agent.module.conversation.service;

import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;

import java.util.List;

/**
 * 会话服务接口
 */
public interface ConversationService {

    /**
     * 获取用户会话列表
     */
    List<Conversation> getConversations(Long userId);

    /**
     * 获取会话消息列表
     */
    List<Message> getMessages(Long conversationId, Long userId);

    /**
     * 删除会话
     */
    void deleteConversation(Long conversationId, Long userId);
}
