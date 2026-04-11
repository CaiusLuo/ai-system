package com.caius.agent.module.conversation.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.conversation.dto.ConversationDTO;
import com.caius.agent.module.conversation.dto.MessageDTO;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
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

    private static final String CONVERSATION_CACHE_KEY = "conversation:messages:";

    @Override
    public List<ConversationDTO> getConversations(Long userId) {
        // 获取会话列表
        List<Conversation> conversations = conversationMapper.selectList(
                new LambdaQueryWrapper<Conversation>()
                        .eq(Conversation::getUserId, userId)
                        .orderByDesc(Conversation::getCreatedAt)
        );

        if (CollectionUtils.isEmpty(conversations)) {
            return Collections.emptyList();
        }

        // 批量获取每个会话的最新消息（一次查询）
        List<Long> conversationIds = conversations.stream()
                .map(Conversation::getId)
                .collect(Collectors.toList());

        // 查询每个会话的最新消息
        Map<Long, Message> latestMessageMap = getLatestMessagesByConversationIds(conversationIds);

        // 转换为 DTO
        return conversations.stream()
                .map(conversation -> convertToConversationDTO(conversation, latestMessageMap.get(conversation.getId())))
                .collect(Collectors.toList());
    }

    @Override
    public List<MessageDTO> getMessages(Long conversationId, Long userId) {
        // 验证会话权限
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null || !conversation.getUserId().equals(userId)) {
            throw new BusinessException("会话不存在或无权限访问");
        }

        // 获取消息列表
        List<Message> messages = messageMapper.selectList(
                new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .orderByAsc(Message::getCreatedAt)
        );

        if (CollectionUtils.isEmpty(messages)) {
            return Collections.emptyList();
        }

        // 批量获取所有用户信息（一次查询，避免 N+1 问题）
        List<Long> userIds = messages.stream()
                .map(Message::getUserId)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, User> userMap = batchGetUsers(userIds);

        // 转换为 DTO（包含用户信息）
        return messages.stream()
                .map(message -> convertToMessageDTO(message, userMap.get(message.getUserId())))
                .collect(Collectors.toList());
    }

    /**
     * 批量获取每个会话的最新消息
     */
    private Map<Long, Message> getLatestMessagesByConversationIds(List<Long> conversationIds) {
        if (CollectionUtils.isEmpty(conversationIds)) {
            return Collections.emptyMap();
        }

        // 查询所有会话的最新消息
        List<Message> latestMessages = messageMapper.selectList(
                new LambdaQueryWrapper<Message>()
                        .in(Message::getConversationId, conversationIds)
                        .orderByDesc(Message::getCreatedAt)
        );

        // 按会话ID分组，取每个会话的第一条（最新）消息
        return latestMessages.stream()
                .collect(Collectors.toMap(
                        Message::getConversationId,
                        message -> message,
                        (existing, replacement) -> existing // 如果有重复，保留第一个
                ));
    }

    /**
     * 批量获取用户信息
     */
    private Map<Long, User> batchGetUsers(List<Long> userIds) {
        if (CollectionUtils.isEmpty(userIds)) {
            return Collections.emptyMap();
        }

        List<User> users = userMapper.selectBatchIds(userIds);
        return users.stream()
                .collect(Collectors.toMap(User::getId, user -> user));
    }

    /**
     * 转换为会话 DTO
     */
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

    /**
     * 转换为消息 DTO
     */
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
    public void deleteConversation(Long conversationId, Long userId) {
        // 验证会话权限
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null || !conversation.getUserId().equals(userId)) {
            throw new BusinessException("会话不存在或无权限删除");
        }

        // 逻辑删除会话
        conversationMapper.deleteById(conversationId);

        // 清除 Redis 缓存
        redisTemplate.delete(CONVERSATION_CACHE_KEY + conversationId);
    }
}
