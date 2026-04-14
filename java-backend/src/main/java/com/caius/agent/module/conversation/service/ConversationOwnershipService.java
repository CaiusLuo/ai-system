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
        // 先判断会话是否存在（且未被逻辑删除），不存在统一返回 404，避免误报“权限不足”
        Conversation conversation = conversationMapper.selectOne(
                new LambdaQueryWrapper<Conversation>()
                        .eq(Conversation::getId, conversationId)
                        .eq(Conversation::getDeleted, 0)
        );

        if (conversation == null) {
            throw new BusinessException(404, "会话不存在或已删除");
        }

        if (userId == null || !userId.equals(conversation.getUserId())) {
            throw new BusinessException(403, "无权访问该会话");
        }

        return conversation;
    }
}
