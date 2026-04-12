package com.caius.agent.module.agent.service;

import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.agent.config.AbortManager;
import com.caius.agent.module.agent.dto.StreamChatRequest;
import com.caius.agent.module.agent.service.impl.StreamChatServiceImpl;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
import com.caius.agent.module.gateway.PythonAgentStreamGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 流式聊天安全边界测试
 */
@ExtendWith(MockitoExtension.class)
class StreamChatServiceAbortTest {

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
    }

    @Test
    @DisplayName("SSE 已有会话必须校验所有权")
    void getOrCreateConversation_WithForeignConversation_ShouldThrow403() {
        StreamChatRequest request = new StreamChatRequest();
        request.setConversationId(100L);
        request.setMessage("hello");

        when(conversationOwnershipService.requireOwnedConversation(100L, 7L))
                .thenThrow(new BusinessException(403, "无权访问该会话"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> ReflectionTestUtils.invokeMethod(streamChatService, "getOrCreateConversation", 7L, request));

        assertEquals(403, exception.getCode());
        assertEquals("无权访问该会话", exception.getMessage());
    }

    @Test
    @DisplayName("按 conversationId 中断必须校验所有权")
    void abortStreamByConversationId_ShouldValidateOwnership() {
        Conversation conversation = new Conversation();
        conversation.setId(100L);
        conversation.setUserId(7L);

        when(conversationOwnershipService.requireOwnedConversation(100L, 7L)).thenReturn(conversation);
        when(abortManager.triggerAbortByConversationId(100L, 7L)).thenReturn(true);

        boolean success = streamChatService.abortStreamByConversationId(7L, 100L);

        assertTrue(success);
        verify(conversationOwnershipService).requireOwnedConversation(100L, 7L);
        verify(abortManager).triggerAbortByConversationId(100L, 7L);
    }

    @Test
    @DisplayName("按 messageId 中断必须带当前用户")
    void abortStream_ShouldPassCurrentUserToAbortManager() {
        when(abortManager.triggerAbort("message-1", 7L)).thenReturn(true);

        boolean success = streamChatService.abortStream(7L, "message-1");

        assertTrue(success);
        verify(abortManager).triggerAbort("message-1", 7L);
    }

    @Test
    @DisplayName("断线恢复必须使用用户作用域 Redis 键")
    void recoverChunks_ShouldUseUserScopedRedisKey() throws Exception {
        Conversation conversation = new Conversation();
        conversation.setId(100L);
        conversation.setUserId(7L);

        @SuppressWarnings({"rawtypes", "unchecked"})
        List<MapRecord<String, Object, Object>> records = (List) List.of(
                MapRecord.create("user:7:stream:100:message-1",
                                Map.of("data", "{\"type\":\"chunk\",\"content\":\"hi\"}"))
                        .withId(RecordId.of("1-0"))
        );

        when(conversationOwnershipService.requireOwnedConversation(100L, 7L)).thenReturn(conversation);
        when(cacheKeyFactory.streamChunks(7L, 100L, "message-1")).thenReturn("user:7:stream:100:message-1");
        when(redisTemplate.opsForStream()).thenReturn(streamOperations);
        when(streamOperations.read(any(StreamOffset.class))).thenReturn(records);
        when(objectMapper.readTree(any(String.class)))
                .thenReturn(new ObjectMapper().readTree("{\"type\":\"chunk\",\"content\":\"hi\"}"));

        streamChatService.recoverChunks(7L, 100L, "message-1", null, new SseEmitter());

        verify(conversationOwnershipService).requireOwnedConversation(100L, 7L);
        verify(cacheKeyFactory).streamChunks(7L, 100L, "message-1");
        verify(streamOperations).read(eq(StreamOffset.fromStart("user:7:stream:100:message-1")));
    }
}
