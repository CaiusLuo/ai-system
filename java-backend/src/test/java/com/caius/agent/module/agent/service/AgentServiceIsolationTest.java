package com.caius.agent.module.agent.service;

import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.dto.ChatRequest;
import com.caius.agent.module.agent.dto.ChatResponse;
import com.caius.agent.module.agent.service.impl.AgentServiceImpl;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
import com.caius.agent.module.gateway.PythonAgentGateway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentServiceIsolationTest {

    @InjectMocks
    private AgentServiceImpl agentService;

    @Mock
    private PythonAgentGateway pythonAgentGateway;

    @Mock
    private ConversationMapper conversationMapper;

    @Mock
    private MessageMapper messageMapper;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ConversationOwnershipService conversationOwnershipService;

    @Mock
    private UserScopedCacheKeyFactory cacheKeyFactory;

    @Mock
    private ListOperations<String, String> listOperations;

    @Test
    @DisplayName("非所有者不能复用别人的会话发消息")
    void chat_WithForeignConversation_ShouldThrow403() {
        ChatRequest request = new ChatRequest();
        request.setConversationId(88L);
        request.setMessage("hello");

        when(conversationOwnershipService.requireOwnedConversation(88L, 7L))
                .thenThrow(new BusinessException(403, "无权访问该会话"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> agentService.chat(7L, request));

        assertEquals(403, exception.getCode());
        assertEquals("无权访问该会话", exception.getMessage());
    }

    @Test
    @DisplayName("聊天上下文缓存必须带用户前缀")
    void chat_ShouldUseUserScopedCacheKey() {
        ChatRequest request = new ChatRequest();
        request.setConversationId(88L);
        request.setMessage("hello");

        Conversation conversation = new Conversation();
        conversation.setId(88L);
        conversation.setUserId(7L);

        when(conversationOwnershipService.requireOwnedConversation(88L, 7L)).thenReturn(conversation);
        when(cacheKeyFactory.conversationMessages(7L, 88L)).thenReturn("user:7:conversation:messages:88");
        when(redisTemplate.opsForList()).thenReturn(listOperations);
        when(listOperations.range("user:7:conversation:messages:88", 0, -1))
                .thenReturn(List.of("Assistant: previous answer"));
        when(pythonAgentGateway.chat(any(), eq("88"))).thenReturn("reply");

        ChatResponse response = agentService.chat(7L, request);

        assertEquals(88L, response.getConversationId());
        assertEquals("reply", response.getReply());
        verify(conversationOwnershipService).requireOwnedConversation(88L, 7L);
        verify(listOperations).range("user:7:conversation:messages:88", 0, -1);
        verify(listOperations).rightPush("user:7:conversation:messages:88", "User: hello");
        verify(listOperations).rightPush("user:7:conversation:messages:88", "Assistant: reply");
        verify(listOperations).trim("user:7:conversation:messages:88", -20, -1);
        verify(redisTemplate).expire("user:7:conversation:messages:88", Duration.ofHours(24));

        ArgumentCaptor<Message> messageCaptor = ArgumentCaptor.forClass(Message.class);
        verify(messageMapper, times(2)).insert(messageCaptor.capture());
        List<Message> savedMessages = messageCaptor.getAllValues();
        assertEquals(2, savedMessages.size());
        assertTrue(savedMessages.stream().allMatch(message -> message.getUserId().equals(7L)));
        assertTrue(savedMessages.stream().allMatch(message -> message.getConversationId().equals(88L)));
    }
}
