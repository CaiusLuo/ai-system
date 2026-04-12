package com.caius.agent.module.agent.service;

import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.common.security.CurrentUserProvider;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.dto.ChatRequest;
import com.caius.agent.module.agent.dto.ChatResponse;
import com.caius.agent.module.agent.service.impl.AgentServiceImpl;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
import com.caius.agent.module.gateway.PythonAgentGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentServiceIsolationTest {

    @Mock
    private PythonAgentGateway pythonAgentGateway;

    @Mock
    private ConversationMapper conversationMapper;

    @Mock
    private MessageMapper messageMapper;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private CurrentUserProvider currentUserProvider;

    @Mock
    private ConversationOwnershipService conversationOwnershipService;

    @Mock
    private UserScopedCacheKeyFactory cacheKeyFactory;

    @Mock
    private ListOperations<String, String> listOperations;

    @InjectMocks
    private AgentServiceImpl agentService;

    @BeforeEach
    void setUp() {
        lenient().when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        lenient().when(redisTemplate.opsForList()).thenReturn(listOperations);
    }

    @Test
    void chat_ShouldUseUserScopedCacheKey() {
        ChatRequest request = new ChatRequest();
        request.setMessage("hello");

        doAnswer(invocation -> {
            Conversation conversation = invocation.getArgument(0);
            conversation.setId(1L);
            return 1;
        }).when(conversationMapper).insert(any(Conversation.class));
        when(cacheKeyFactory.conversationMessages(1L, 1L))
                .thenReturn("user:1:conversation:messages:1");
        when(listOperations.range("user:1:conversation:messages:1", 0, -1))
                .thenReturn(List.of("Assistant: previous"));
        when(pythonAgentGateway.chat(any(String.class), any(String.class))).thenReturn("reply");
        when(redisTemplate.expire("user:1:conversation:messages:1", Duration.ofHours(24))).thenReturn(true);

        ChatResponse response = agentService.chat(request);

        assertEquals(1L, response.getConversationId());
        assertEquals("reply", response.getReply());
        verify(listOperations, times(1)).range("user:1:conversation:messages:1", 0, -1);
        verify(listOperations, times(1)).rightPush("user:1:conversation:messages:1", "User: hello");
        verify(listOperations, times(1)).rightPush("user:1:conversation:messages:1", "Assistant: reply");
    }

    @Test
    void chat_ShouldRejectOtherUsersConversation() {
        ChatRequest request = new ChatRequest();
        request.setConversationId(99L);
        request.setMessage("hello");

        when(conversationOwnershipService.requireOwnedConversation(99L, 1L))
                .thenThrow(new BusinessException(403, "无权访问该会话"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> agentService.chat(request));

        assertEquals(403, exception.getCode());
        assertEquals("无权访问该会话", exception.getMessage());
        verifyNoInteractions(pythonAgentGateway);
    }
}
