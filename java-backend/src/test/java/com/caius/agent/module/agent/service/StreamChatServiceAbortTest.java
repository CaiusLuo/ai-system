package com.caius.agent.module.agent.service;

import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.common.security.CurrentUserProvider;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.config.AbortManager;
import com.caius.agent.module.agent.service.impl.StreamChatServiceImpl;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
import com.caius.agent.module.gateway.PythonAgentStreamGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 流式会话用户隔离测试
 */
@ExtendWith(MockitoExtension.class)
public class StreamChatServiceAbortTest {

    @InjectMocks
    private StreamChatServiceImpl streamChatService;

    @Mock
    private PythonAgentStreamGateway streamGateway;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private MessageMapper messageMapper;

    @Mock
    private ConversationMapper conversationMapper;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private AbortManager abortManager;

    @Mock
    private CurrentUserProvider currentUserProvider;

    @Mock
    private ConversationOwnershipService conversationOwnershipService;

    @Mock
    private UserScopedCacheKeyFactory cacheKeyFactory;

    @Mock
    private StreamOperations<String, Object, Object> streamOperations;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(streamChatService, "maxChunksPerMessage", 5000);
        ReflectionTestUtils.setField(streamChatService, "chunkTtlSeconds", 3600);
        ReflectionTestUtils.setField(streamChatService, "perUserLimit", 5);
        ReflectionTestUtils.setField(streamChatService, "taskTimeoutMinutes", 10);

        Conversation conversation = new Conversation();
        conversation.setId(100L);
        conversation.setUserId(1L);

        lenient().when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        lenient().when(conversationOwnershipService.requireOwnedConversation(100L, 1L)).thenReturn(conversation);
    }

    @Test
    void abortStreamByConversationId_ShouldValidateOwnerAndTriggerAbort() {
        when(abortManager.triggerAbortByConversationId(100L, 1L)).thenReturn(true);

        boolean success = streamChatService.abortStreamByConversationId(100L);

        assertTrue(success);
        verify(conversationOwnershipService, times(1)).requireOwnedConversation(100L, 1L);
        verify(abortManager, times(1)).triggerAbortByConversationId(100L, 1L);
    }

    @Test
    void abortStream_ShouldUseCurrentUserOwnership() {
        when(abortManager.triggerAbort("test-message-id", 1L)).thenReturn(true);

        boolean success = streamChatService.abortStream("test-message-id");

        assertTrue(success);
        verify(abortManager, times(1)).triggerAbort("test-message-id", 1L);
    }

    @Test
    void recoverChunks_ShouldReadUserScopedRedisKey() {
        when(cacheKeyFactory.streamChunks(1L, 100L, "message-1"))
                .thenReturn("user:1:stream:100:message-1");
        when(redisTemplate.opsForStream()).thenReturn(streamOperations);
        when(streamOperations.read(any(StreamOffset.class))).thenReturn(null);

        streamChatService.recoverChunks(100L, "message-1", null, new SseEmitter());

        @SuppressWarnings("rawtypes")
        ArgumentCaptor<StreamOffset> captor = ArgumentCaptor.forClass(StreamOffset.class);
        verify(streamOperations, times(1)).read(captor.capture());
        assertEquals("user:1:stream:100:message-1", captor.getValue().getKey());
    }
}
