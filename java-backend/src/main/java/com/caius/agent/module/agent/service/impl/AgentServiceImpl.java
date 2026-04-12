package com.caius.agent.module.agent.service.impl;

import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.common.security.CurrentUserProvider;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.dto.ChatRequest;
import com.caius.agent.module.agent.dto.ChatResponse;
import com.caius.agent.module.agent.service.AgentService;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
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
    private final CurrentUserProvider currentUserProvider;
    private final ConversationOwnershipService conversationOwnershipService;
    private final UserScopedCacheKeyFactory cacheKeyFactory;

    @Override
    @Transactional
    public ChatResponse chat(ChatRequest request) {
        Long userId = currentUserProvider.requireCurrentUserId();
        Long conversationId = request.getConversationId();

        if (conversationId == null) {
            Conversation conversation = new Conversation();
            conversation.setUserId(userId);
            conversation.setTitle(request.getMessage().substring(0, Math.min(20, request.getMessage().length())));
            conversationMapper.insert(conversation);
            conversationId = conversation.getId();
        } else {
            Conversation conversation = conversationOwnershipService.requireOwnedConversation(conversationId, userId);
            conversationId = conversation.getId();
        }

        Message userMessage = new Message();
        userMessage.setConversationId(conversationId);
        userMessage.setUserId(userId);
        userMessage.setRole("user");
        userMessage.setContent(request.getMessage());
        messageMapper.insert(userMessage);

        String cacheKey = cacheKeyFactory.conversationMessages(userId, conversationId);
        List<String> contextMessages = redisTemplate.opsForList().range(cacheKey, 0, -1);

        StringBuilder contextBuilder = new StringBuilder();
        if (contextMessages != null && !contextMessages.isEmpty()) {
            for (String msg : contextMessages) {
                contextBuilder.append(msg).append("\n");
            }
        }
        contextBuilder.append("User: ").append(request.getMessage());

        String reply = pythonAgentGateway.chat(contextBuilder.toString(), conversationId.toString());

        Message assistantMessage = new Message();
        assistantMessage.setConversationId(conversationId);
        assistantMessage.setUserId(userId);
        assistantMessage.setRole("assistant");
        assistantMessage.setContent(reply);
        messageMapper.insert(assistantMessage);

        redisTemplate.opsForList().rightPush(cacheKey, "User: " + request.getMessage());
        redisTemplate.opsForList().rightPush(cacheKey, "Assistant: " + reply);
        redisTemplate.opsForList().trim(cacheKey, -20, -1);
        redisTemplate.expire(cacheKey, java.time.Duration.ofHours(24));

        return new ChatResponse(reply, conversationId);
    }
}
