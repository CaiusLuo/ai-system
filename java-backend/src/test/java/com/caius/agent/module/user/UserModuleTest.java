package com.caius.agent.module.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.user.dto.UserDTO;
import com.caius.agent.module.user.entity.User;
import com.caius.agent.module.user.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 用户模块测试
 * - Service 层单元测试（不依赖 Spring Context）
 */
@DisplayName("用户模块测试")
@ExtendWith(MockitoExtension.class)
class UserModuleTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserServiceImpl userService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPassword("$2a$10$encodedPassword");
        testUser.setRole("USER");
        testUser.setStatus(1);
    }

    @Nested
    @DisplayName("获取用户信息测试")
    class GetUserTests {

        @Test
        @DisplayName("正常获取用户信息 - 返回 DTO 不含密码")
        void getUserById_Success() {
            when(userMapper.selectById(1L)).thenReturn(testUser);

            UserDTO result = userService.getUserById(1L);

            assertNotNull(result);
            assertEquals(1L, result.getId());
            assertEquals("testuser", result.getUsername());
            assertEquals("test@example.com", result.getEmail());
            assertEquals("USER", result.getRole());
            assertEquals(1, result.getStatus());
            assertEquals("ACTIVE", result.getStatusText());
        }

        @Test
        @DisplayName("获取用户信息 - 用户不存在")
        void getUserById_UserNotFound() {
            when(userMapper.selectById(999L)).thenReturn(null);

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> userService.getUserById(999L));
            assertEquals("用户不存在", exception.getMessage());
        }
    }

    @Nested
    @DisplayName("更新用户信息测试")
    class UpdateUserTests {

        @Test
        @DisplayName("更新邮箱 - 成功")
        void updateUser_Email_Success() {
            User updateRequest = new User();
            updateRequest.setEmail("newemail@example.com");
            when(userMapper.selectById(1L)).thenReturn(testUser);
            when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);

            userService.updateUser(1L, updateRequest);

            assertEquals("newemail@example.com", testUser.getEmail());
        }

        @Test
        @DisplayName("更新邮箱 - 邮箱已被其他用户使用")
        void updateUser_EmailConflict() {
            User updateRequest = new User();
            updateRequest.setEmail("existing@example.com");
            when(userMapper.selectById(1L)).thenReturn(testUser);
            when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> userService.updateUser(1L, updateRequest));
            assertEquals("邮箱已被使用", exception.getMessage());
        }

        @Test
        @DisplayName("更新密码 - 密码会被加密")
        void updateUser_Password_Encrypted() {
            User updateRequest = new User();
            updateRequest.setPassword("newPassword123");
            when(userMapper.selectById(1L)).thenReturn(testUser);
            when(passwordEncoder.encode("newPassword123")).thenReturn("$2a$10$newEncodedPassword");

            userService.updateUser(1L, updateRequest);

            verify(passwordEncoder, times(1)).encode("newPassword123");
        }

        @Test
        @DisplayName("更新用户名 - 成功")
        void updateUser_Username_Success() {
            User updateRequest = new User();
            updateRequest.setUsername("newUsername");
            when(userMapper.selectById(1L)).thenReturn(testUser);
            when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);

            userService.updateUser(1L, updateRequest);

            assertEquals("newUsername", testUser.getUsername());
        }

        @Test
        @DisplayName("更新用户名 - 用户名已被其他用户使用")
        void updateUser_UsernameConflict() {
            User updateRequest = new User();
            updateRequest.setUsername("existingUser");
            when(userMapper.selectById(1L)).thenReturn(testUser);
            when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> userService.updateUser(1L, updateRequest));
            assertEquals("用户名已被使用", exception.getMessage());
        }

        @Test
        @DisplayName("更新用户 - 用户不存在")
        void updateUser_UserNotFound() {
            User updateRequest = new User();
            updateRequest.setEmail("new@example.com");
            when(userMapper.selectById(999L)).thenReturn(null);

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> userService.updateUser(999L, updateRequest));
            assertEquals("用户不存在", exception.getMessage());
        }

        @Test
        @DisplayName("更新用户 - 空更新请求（仍然会调用 updateById）")
        void updateUser_EmptyRequest() {
            User updateRequest = new User();
            when(userMapper.selectById(1L)).thenReturn(testUser);
            when(userMapper.updateById(any(User.class))).thenReturn(1);

            userService.updateUser(1L, updateRequest);

            // Service 仍然会调用 updateById 更新对象
            verify(userMapper, times(1)).updateById(any(User.class));
        }
    }
}
