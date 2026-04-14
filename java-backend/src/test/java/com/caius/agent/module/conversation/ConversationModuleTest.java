package com.caius.agent.module.conversation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.common.cache.UserScopedCacheKeyFactory;
import com.caius.agent.dao.ConversationMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.conversation.dto.ConversationDTO;
import com.caius.agent.module.conversation.dto.MessageDTO;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.conversation.service.ConversationOwnershipService;
import com.caius.agent.module.conversation.service.impl.ConversationServiceImpl;
import com.caius.agent.module.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 会话模块测试
 * - Service 层单元测试（不依赖 Spring Context）
 */
@DisplayName("会话模块测试")
@ExtendWith(MockitoExtension.class)
class ConversationModuleTest {

    @Mock
    private ConversationMapper conversationMapper;

    @Mock
    private MessageMapper messageMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ConversationOwnershipService conversationOwnershipService;

    @Mock
    private UserScopedCacheKeyFactory cacheKeyFactory;

    @InjectMocks
    private ConversationServiceImpl conversationService;

    @Nested
    @DisplayName("获取会话列表测试")
    class GetConversationsTests {

        @Test
        @DisplayName("获取会话列表 - 包含最新消息预览")
        void getConversations_WithLatestMessage() {
            Conversation conv = new Conversation();
            conv.setId(1L);
            conv.setUserId(1L);
            conv.setTitle("Test Conversation");
            conv.setCreatedAt(LocalDateTime.now().minusDays(1));

            Message latestMsg = new Message();
            latestMsg.setId(2L);
            latestMsg.setConversationId(1L);
            latestMsg.setContent("Latest message");
            latestMsg.setCreatedAt(LocalDateTime.now());

            when(conversationMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Arrays.asList(conv));
            when(messageMapper.selectObjs(any(QueryWrapper.class)))
                    .thenReturn(Arrays.asList(2L));
            when(messageMapper.selectBatchIds(anyList()))
                    .thenReturn(Arrays.asList(latestMsg));

            List<ConversationDTO> result = conversationService.getConversations(1L);

            assertNotNull(result);
            assertEquals(1, result.size());
            assertEquals("Test Conversation", result.get(0).getTitle());
            assertEquals("Latest message", result.get(0).getLastMessageContent());
        }

        @Test
        @DisplayName("获取会话列表 - 空列表")
        void getConversations_EmptyList() {
            when(conversationMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Collections.emptyList());

            List<ConversationDTO> result = conversationService.getConversations(1L);

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("获取会话列表 - 会话没有消息")
        void getConversations_NoMessages() {
            Conversation conv = new Conversation();
            conv.setId(1L);
            conv.setUserId(1L);
            conv.setTitle("Empty Conversation");
            conv.setCreatedAt(LocalDateTime.now().minusDays(1));

            when(conversationMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Arrays.asList(conv));
            when(messageMapper.selectObjs(any(QueryWrapper.class)))
                    .thenReturn(Collections.emptyList());

            List<ConversationDTO> result = conversationService.getConversations(1L);

            assertNotNull(result);
            assertEquals(1, result.size());
            assertNull(result.get(0).getLastMessageContent());
        }

        @Test
        @DisplayName("获取会话列表 - 最新消息查询不按 userId 过滤")
        void getConversations_LatestMessageQueryNotFilteredByUserId() {
            Conversation conv = new Conversation();
            conv.setId(1L);
            conv.setUserId(1L);
            conv.setTitle("Cross Device");
            conv.setCreatedAt(LocalDateTime.now().minusDays(1));

            when(conversationMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Arrays.asList(conv));
            when(messageMapper.selectObjs(any(QueryWrapper.class)))
                    .thenReturn(Collections.emptyList());

            conversationService.getConversations(1L);

            ArgumentCaptor<QueryWrapper<Message>> captor = ArgumentCaptor.forClass(QueryWrapper.class);
            verify(messageMapper).selectObjs(captor.capture());
            String sqlSegment = captor.getValue().getCustomSqlSegment();
            assertFalse(sqlSegment.contains("user_id"));
        }
    }

    @Nested
    @DisplayName("获取消息列表测试")
    class GetMessagesTests {

        @Test
        @DisplayName("获取消息列表 - 包含用户名（批量查询优化）")
        void getMessages_WithUsername() {
            Conversation conv = new Conversation();
            conv.setId(1L);
            conv.setUserId(1L);

            Message msg = new Message();
            msg.setId(1L);
            msg.setConversationId(1L);
            msg.setUserId(1L);
            msg.setRole("user");
            msg.setContent("Hello");

            User user = new User();
            user.setId(1L);
            user.setUsername("testuser");

            when(conversationOwnershipService.requireOwnedConversation(1L, 1L)).thenReturn(conv);
            when(messageMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Arrays.asList(msg));
            when(userMapper.selectBatchIds(anyList()))
                    .thenReturn(Arrays.asList(user));

            List<MessageDTO> result = conversationService.getMessages(1L, 1L);

            assertNotNull(result);
            assertEquals(1, result.size());
            assertEquals("testuser", result.get(0).getUsername());

            // 验证只调用了一次批量查询（而非循环查询）
            verify(userMapper, times(1)).selectBatchIds(anyList());
        }

        @Test
        @DisplayName("获取消息列表 - 权限验证失败")
        void getMessages_InvalidPermission() {
            when(conversationOwnershipService.requireOwnedConversation(1L, 1L))
                    .thenThrow(new BusinessException(403, "无权访问该会话"));

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> conversationService.getMessages(1L, 1L));
            assertEquals("无权访问该会话", exception.getMessage());
        }

        @Test
        @DisplayName("获取消息列表 - 空列表")
        void getMessages_EmptyList() {
            Conversation conv = new Conversation();
            conv.setId(1L);
            conv.setUserId(1L);

            when(conversationOwnershipService.requireOwnedConversation(1L, 1L)).thenReturn(conv);
            when(messageMapper.selectList(any(LambdaQueryWrapper.class)))
                    .thenReturn(Collections.emptyList());

            List<MessageDTO> result = conversationService.getMessages(1L, 1L);

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    @Nested
    @DisplayName("删除会话测试")
    class DeleteConversationTests {

        @Test
        @DisplayName("删除会话 - 成功")
        void deleteConversation_Success() {
            Conversation conv = new Conversation();
            conv.setId(1L);
            conv.setUserId(1L);

            when(conversationOwnershipService.requireOwnedConversation(1L, 1L)).thenReturn(conv);
            when(conversationMapper.deleteById(1L)).thenReturn(1);
            when(cacheKeyFactory.conversationMessages(1L, 1L)).thenReturn("user:1:conversation:messages:1");
            when(redisTemplate.delete(anyString())).thenReturn(true);

            conversationService.deleteConversation(1L, 1L);

            verify(conversationMapper, times(1)).deleteById(1L);
            verify(redisTemplate, times(1)).delete("user:1:conversation:messages:1");
        }

        @Test
        @DisplayName("删除会话 - 权限验证失败")
        void deleteConversation_InvalidPermission() {
            when(conversationOwnershipService.requireOwnedConversation(1L, 1L))
                    .thenThrow(new BusinessException(403, "无权访问该会话"));

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> conversationService.deleteConversation(1L, 1L));
            assertEquals("无权访问该会话", exception.getMessage());
        }

        @Test
        @DisplayName("删除会话 - 会话不存在")
        void deleteConversation_NotFound() {
            when(conversationOwnershipService.requireOwnedConversation(999L, 1L))
                    .thenThrow(new BusinessException(403, "无权访问该会话"));

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> conversationService.deleteConversation(999L, 1L));
            assertEquals("无权访问该会话", exception.getMessage());
        }
    }
}
