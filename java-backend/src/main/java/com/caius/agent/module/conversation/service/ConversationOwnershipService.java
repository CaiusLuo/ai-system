package com.caius.agent.module.conversation.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.module.conversation.entity.Conversation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 会话所有权校验。
 */
@Service
@RequiredArgsConstructor
public class ConversationOwnershipService {

    private final ConversationMapper conversationMapper;

    public Conversation requireOwnedConversation(Long conversationId, Long userId) {
        Conversation conversation = conversationMapper.selectOne(
                new LambdaQueryWrapper<Conversation>()
                        .eq(Conversation::getId, conversationId)
                        .eq(Conversation::getUserId, userId)
        );

        if (conversation == null) {
            throw new BusinessException(403, "无权访问该会话");
        }

        return conversation;
    }
}
