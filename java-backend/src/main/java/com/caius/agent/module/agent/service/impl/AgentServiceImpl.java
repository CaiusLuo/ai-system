package com.caius.agent.module.agent.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.dto.ChatRequest;
import com.caius.agent.module.agent.dto.ChatResponse;
import com.caius.agent.module.agent.service.AgentService;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.gateway.PythonAgentGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Agent 服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentServiceImpl implements AgentService {

    private final PythonAgentGateway pythonAgentGateway;
    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final StringRedisTemplate redisTemplate;

    private static final String CONVERSATION_CACHE_KEY = "conversation:messages:";

    @Override
    @Transactional
    public ChatResponse chat(Long userId, ChatRequest request) {
        Long conversationId = request.getConversationId();

        // 如果没有传会话ID，创建新会话
        if (conversationId == null) {
            Conversation conversation = new Conversation();
            conversation.setUserId(userId);
            conversation.setTitle(request.getMessage().substring(0, Math.min(20, request.getMessage().length())));
            conversationMapper.insert(conversation);
            conversationId = conversation.getId();
        } else {
            // 验证会话是否存在
            Conversation conversation = conversationMapper.selectById(conversationId);
            if (conversation == null || !conversation.getUserId().equals(userId)) {
                throw new BusinessException("会话不存在");
            }
        }

        // 保存用户消息
        Message userMessage = new Message();
        userMessage.setConversationId(conversationId);
        userMessage.setUserId(userId);
        userMessage.setRole("user");
        userMessage.setContent(request.getMessage());
        messageMapper.insert(userMessage);

        // 从 Redis 获取上下文（最近10条消息）
        String cacheKey = CONVERSATION_CACHE_KEY + conversationId;
        List<String> contextMessages = redisTemplate.opsForList().range(cacheKey, 0, -1);

        // 构造上下文消息
        StringBuilder contextBuilder = new StringBuilder();
        if (contextMessages != null && !contextMessages.isEmpty()) {
            for (String msg : contextMessages) {
                contextBuilder.append(msg).append("\n");
            }
        }
        contextBuilder.append("User: ").append(request.getMessage());

        // 调用 Python Agent
        String reply = pythonAgentGateway.chat(contextBuilder.toString(), conversationId.toString());

        // 保存 AI 回复
        Message assistantMessage = new Message();
        assistantMessage.setConversationId(conversationId);
        assistantMessage.setUserId(userId);
        assistantMessage.setRole("assistant");
        assistantMessage.setContent(reply);
        messageMapper.insert(assistantMessage);

        // 更新 Redis 缓存（保留最近20条）
        redisTemplate.opsForList().rightPush(cacheKey, "User: " + request.getMessage());
        redisTemplate.opsForList().rightPush(cacheKey, "Assistant: " + reply);
        redisTemplate.opsForList().trim(cacheKey, -20, -1);
        redisTemplate.expire(cacheKey, java.time.Duration.ofHours(24));

        return new ChatResponse(reply, conversationId);
    }
}
