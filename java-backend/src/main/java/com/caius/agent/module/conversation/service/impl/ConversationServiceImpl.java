package com.caius.agent.module.conversation.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.common.security.CurrentUserProvider;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.conversation.dto.ConversationDTO;
import com.caius.agent.module.conversation.dto.MessageDTO;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
import com.caius.agent.module.conversation.service.ConversationService;
import com.caius.agent.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 会话服务实现
 */
@Service
@RequiredArgsConstructor
public class ConversationServiceImpl implements ConversationService {

    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final UserMapper userMapper;
    private final StringRedisTemplate redisTemplate;
    private final CurrentUserProvider currentUserProvider;
    private final ConversationOwnershipService conversationOwnershipService;
    private final UserScopedCacheKeyFactory cacheKeyFactory;

    @Override
    public List<ConversationDTO> getConversations() {
        Long userId = currentUserProvider.requireCurrentUserId();

        List<Conversation> conversations = conversationMapper.selectList(
                new LambdaQueryWrapper<Conversation>()
                        .eq(Conversation::getUserId, userId)
                        .orderByDesc(Conversation::getCreatedAt)
        );

        if (CollectionUtils.isEmpty(conversations)) {
            return Collections.emptyList();
        }

        List<Long> conversationIds = conversations.stream()
                .map(Conversation::getId)
                .collect(Collectors.toList());

        Map<Long, Message> latestMessageMap = getLatestMessagesByConversationIds(userId, conversationIds);

        return conversations.stream()
                .map(conversation -> convertToConversationDTO(conversation, latestMessageMap.get(conversation.getId())))
                .collect(Collectors.toList());
    }

    @Override
    public List<MessageDTO> getMessages(Long conversationId) {
        Long userId = currentUserProvider.requireCurrentUserId();
        conversationOwnershipService.requireOwnedConversation(conversationId, userId);

        List<Message> messages = messageMapper.selectList(
                new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .eq(Message::getUserId, userId)
                        .orderByAsc(Message::getCreatedAt)
        );

        if (CollectionUtils.isEmpty(messages)) {
            return Collections.emptyList();
        }

        List<Long> userIds = messages.stream()
                .map(Message::getUserId)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, User> userMap = batchGetUsers(userIds);

        return messages.stream()
                .map(message -> convertToMessageDTO(message, userMap.get(message.getUserId())))
                .collect(Collectors.toList());
    }

    private Map<Long, Message> getLatestMessagesByConversationIds(Long userId, List<Long> conversationIds) {
        if (CollectionUtils.isEmpty(conversationIds)) {
            return Collections.emptyMap();
        }

        List<Message> latestMessages = messageMapper.selectList(
                new LambdaQueryWrapper<Message>()
                        .in(Message::getConversationId, conversationIds)
                        .eq(Message::getUserId, userId)
                        .orderByDesc(Message::getCreatedAt)
        );

        return latestMessages.stream()
                .collect(Collectors.toMap(
                        Message::getConversationId,
                        message -> message,
                        (existing, replacement) -> existing
                ));
    }

    private Map<Long, User> batchGetUsers(List<Long> userIds) {
        if (CollectionUtils.isEmpty(userIds)) {
            return Collections.emptyMap();
        }

        List<User> users = userMapper.selectBatchIds(userIds);
        return users.stream()
                .collect(Collectors.toMap(User::getId, user -> user));
    }

    private ConversationDTO convertToConversationDTO(Conversation conversation, Message latestMessage) {
        return ConversationDTO.builder()
                .id(conversation.getId())
                .userId(conversation.getUserId())
                .title(conversation.getTitle())
                .lastMessageContent(latestMessage != null ? latestMessage.getContent() : null)
                .lastMessageTime(latestMessage != null ? latestMessage.getCreatedAt() : conversation.getCreatedAt())
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }

    private MessageDTO convertToMessageDTO(Message message, User user) {
        return MessageDTO.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .userId(message.getUserId())
                .username(user != null ? user.getUsername() : null)
                .role(message.getRole())
                .content(message.getContent())
                .title(message.getTitle())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .build();
    }

    @Override
    public void deleteConversation(Long conversationId) {
        Long userId = currentUserProvider.requireCurrentUserId();
        conversationOwnershipService.requireOwnedConversation(conversationId, userId);

        messageMapper.delete(
                new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .eq(Message::getUserId, userId)
        );

        int deleted = conversationMapper.delete(
                new LambdaQueryWrapper<Conversation>()
                        .eq(Conversation::getId, conversationId)
                        .eq(Conversation::getUserId, userId)
        );
        if (deleted == 0) {
            throw new BusinessException(403, "无权删除该会话");
        }

        redisTemplate.delete(cacheKeyFactory.conversationMessages(userId, conversationId));
    }
}
