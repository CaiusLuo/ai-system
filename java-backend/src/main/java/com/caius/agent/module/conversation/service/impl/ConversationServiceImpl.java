package com.caius.agent.module.conversation.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
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
import lombok.extern.log4j.Log4j;
import lombok.extern.log4j.Log4j2;
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
@Log4j2
public class ConversationServiceImpl implements ConversationService {

    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final UserMapper userMapper;
    private final StringRedisTemplate redisTemplate;
    private final ConversationOwnershipService conversationOwnershipService;
    private final UserScopedCacheKeyFactory cacheKeyFactory;

    @Override
    public List<ConversationDTO> getConversations(Long userId) {
        // 获取会话列表
        List<Conversation> conversations = conversationMapper.selectList(
                new LambdaQueryWrapper<Conversation>()
                        .eq(Conversation::getUserId, userId)
                        // 删除对话不显示
                        .eq(Conversation::getDeleted, 0)
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
        // ⭐ 修复 BUG-4：先校验 ownership，再按 conversationId 查所有消息
        // assistant 消息的 userId 与 conversation 的 ownerId 一致
        // 不再额外按 userId 过滤 message 表（避免数据不一致时消息"消失"）
        conversationOwnershipService.requireOwnedConversation(conversationId, userId);

        List<Message> messages = messageMapper.selectList(
                new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .eq(Message::getDeleted, 0)
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

        QueryWrapper<Message> latestIdQuery = new QueryWrapper<>();
        latestIdQuery.select("MAX(id) AS id")
                .in("conversation_id", conversationIds)
                .eq("deleted", 0)
                .groupBy("conversation_id");
        List<Object> latestIdObjs = messageMapper.selectObjs(latestIdQuery);
        List<Long> latestIds = latestIdObjs.stream()
                .filter(obj -> obj instanceof Number)
                .map(obj -> ((Number) obj).longValue())
                .collect(Collectors.toList());
        if (CollectionUtils.isEmpty(latestIds)) {
            return Collections.emptyMap();
        }

        // 批量读取每个会话的最新消息
        List<Message> latestMessages = messageMapper.selectBatchIds(latestIds);

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
        log.info("deleteConversation: userId={}, conversationId={}", userId, conversationId);
        conversationOwnershipService.requireOwnedConversation(conversationId, userId);

        // 逻辑删除会话
        conversationMapper.deleteById(conversationId);
        // 逻辑删除会话消息
        messageMapper.delete(new LambdaQueryWrapper<Message>()
                .eq(Message::getConversationId, conversationId)
        );

        // 清除 Redis 缓存
        redisTemplate.delete(cacheKeyFactory.conversationMessages(userId, conversationId));
    }
}
