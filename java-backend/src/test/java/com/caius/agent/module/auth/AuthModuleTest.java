package com.caius.agent.module.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.common.util.JwtUtil;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.auth.dto.LoginRequest;
import com.caius.agent.module.auth.dto.RegisterRequest;
import com.caius.agent.module.auth.service.impl.AuthServiceImpl;
import com.caius.agent.module.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 认证模块测试
 * - Service 层单元测试（不依赖 Spring Context）
 */
@DisplayName("认证模块测试")
@ExtendWith(MockitoExtension.class)
class AuthModuleTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private AuthServiceImpl authService;

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
    @DisplayName("登录测试")
    class LoginTests {

        @Test
        @DisplayName("正常登录 - 返回 Token 和用户信息")
        void login_Success() {
            when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(testUser);
            when(passwordEncoder.matches("password123", "$2a$10$encodedPassword")).thenReturn(true);
            when(jwtUtil.generateToken(1L, "testuser", "USER")).thenReturn("mockToken");

            LoginRequest request = new LoginRequest();
            request.setUsername("testuser");
            request.setPassword("password123");

            Map<String, Object> result = authService.login(request);

            assertEquals("mockToken", result.get("token"));
            assertEquals(1L, result.get("userId"));
            assertEquals("testuser", result.get("username"));
            assertEquals("USER", result.get("role"));
        }

        @Test
        @DisplayName("登录失败 - 用户不存在")
        void login_UserNotFound() {
            when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

            LoginRequest request = new LoginRequest();
            request.setUsername("nonexistent");
            request.setPassword("password123");

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> authService.login(request));
            assertEquals("用户不存在", exception.getMessage());
        }

        @Test
        @DisplayName("登录失败 - 密码错误")
        void login_WrongPassword() {
            // Use lenient stubbing to avoid strict stubbing issues
            when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(testUser);
            lenient().when(passwordEncoder.matches("wrongpassword", "$2a$10$encodedPassword")).thenReturn(false);

            LoginRequest request = new LoginRequest();
            request.setUsername("testuser");
            request.setPassword("wrongpassword");

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> authService.login(request));
            assertEquals("密码错误", exception.getMessage());
        }

        @Test
        @DisplayName("登录失败 - 用户被禁用")
        void login_UserDisabled() {
            testUser.setStatus(0);
            when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(testUser);
            when(passwordEncoder.matches("password123", "$2a$10$encodedPassword")).thenReturn(true);

            LoginRequest request = new LoginRequest();
            request.setUsername("testuser");
            request.setPassword("password123");

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> authService.login(request));
            assertEquals("用户已被禁用", exception.getMessage());
        }
    }

    @Nested
    @DisplayName("注册测试")
    class RegisterTests {

        @Test
        @DisplayName("正常注册 - 成功创建用户")
        void register_Success() {
            when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
            when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encodedPassword");

            RegisterRequest request = new RegisterRequest();
            request.setUsername("newuser");
            request.setEmail("newuser@example.com");
            request.setPassword("password123");

            authService.register(request);

            verify(userMapper, times(1)).insert(any(User.class));
            verify(passwordEncoder, times(1)).encode("password123");
        }

        @Test
        @DisplayName("注册失败 - 用户名已存在")
        void register_UsernameExists() {
            when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

            RegisterRequest request = new RegisterRequest();
            request.setUsername("existing");
            request.setEmail("test@example.com");
            request.setPassword("password123");

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> authService.register(request));
            assertEquals("用户名已存在", exception.getMessage());
        }

        @Test
        @DisplayName("注册失败 - 邮箱已存在")
        void register_EmailExists() {
            when(userMapper.selectCount(any(LambdaQueryWrapper.class)))
                    .thenReturn(0L)
                    .thenReturn(1L);

            RegisterRequest request = new RegisterRequest();
            request.setUsername("newuser");
            request.setEmail("existing@example.com");
            request.setPassword("password123");

            BusinessException exception = assertThrows(BusinessException.class,
                    () -> authService.register(request));
            assertEquals("邮箱已存在", exception.getMessage());
        }
    }
}
