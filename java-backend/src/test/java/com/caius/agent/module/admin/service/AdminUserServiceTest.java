package com.caius.agent.module.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.admin.dto.UserCreateRequest;
import com.caius.agent.module.admin.dto.UserListRequest;
import com.caius.agent.module.admin.dto.UserListResponse;
import com.caius.agent.module.admin.dto.UserUpdateRequest;
import com.caius.agent.module.admin.service.impl.AdminUserServiceImpl;
import com.caius.agent.module.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * AdminUserService 单元测试
 */
@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private AdminUserServiceImpl adminUserService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPassword("hashedPassword");
        testUser.setRole("USER");
        testUser.setStatus(1);
        testUser.setDeleted(0);
        testUser.setCreatedAt(LocalDateTime.now());
        testUser.setUpdatedAt(LocalDateTime.now());
    }

    @Test
    void listUsers_Success() {
        // 准备数据
        UserListRequest request = new UserListRequest();
        request.setPage(1);
        request.setPageSize(10);

        Page<User> userPage = new Page<>(1, 10);
        userPage.setRecords(Arrays.asList(testUser));
        userPage.setTotal(1L);
        userPage.setCurrent(1);
        userPage.setSize(10);

        when(userMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(userPage);

        // 执行测试
        UserListResponse response = adminUserService.listUsers(request);

        // 验证结果
        assertNotNull(response);
        assertEquals(1, response.getTotal());
        assertEquals(1, response.getPage());
        assertEquals(10, response.getPageSize());
        assertEquals(1, response.getList().size());
        assertEquals("testuser", response.getList().get(0).getUsername());
        assertEquals("test@example.com", response.getList().get(0).getEmail());
        assertEquals("USER", response.getList().get(0).getRole());
        assertEquals("ACTIVE", response.getList().get(0).getStatus());

        verify(userMapper, times(1)).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    @Test
    void listUsers_WithKeyword() {
        // 准备数据
        UserListRequest request = new UserListRequest();
        request.setPage(1);
        request.setPageSize(10);
        request.setKeyword("test");

        Page<User> userPage = new Page<>(1, 10);
        userPage.setRecords(Arrays.asList(testUser));
        userPage.setTotal(1L);

        when(userMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(userPage);

        // 执行测试
        UserListResponse response = adminUserService.listUsers(request);

        // 验证结果
        assertNotNull(response);
        assertEquals(1, response.getTotal());
        verify(userMapper, times(1)).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    @Test
    void createUser_Success() {
        // 准备数据
        UserCreateRequest request = new UserCreateRequest();
        request.setUsername("newuser");
        request.setEmail("new@example.com");
        request.setPassword("password123");
        request.setRole("USER");
        request.setStatus("ACTIVE");

        when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(2L);
            return 1;
        });

        // 执行测试
        UserListResponse.UserDTO response = adminUserService.createUser(request);

        // 验证结果
        assertNotNull(response);
        assertEquals("newuser", response.getUsername());
        assertEquals("new@example.com", response.getEmail());
        assertEquals("USER", response.getRole());
        assertEquals("ACTIVE", response.getStatus());

        verify(userMapper, times(2)).selectCount(any(LambdaQueryWrapper.class));
        verify(userMapper, times(1)).insert(any(User.class));
    }

    @Test
    void createUser_UsernameAlreadyExists() {
        // 准备数据
        UserCreateRequest request = new UserCreateRequest();
        request.setUsername("existinguser");
        request.setEmail("new@example.com");
        request.setPassword("password123");
        request.setRole("USER");
        request.setStatus("ACTIVE");

        when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        // 执行测试并验证异常
        BusinessException exception = assertThrows(BusinessException.class,
                () -> adminUserService.createUser(request));
        assertEquals(409, exception.getCode());
        assertEquals("用户名已存在", exception.getMessage());
    }

    @Test
    void createUser_EmailAlreadyExists() {
        // 准备数据
        UserCreateRequest request = new UserCreateRequest();
        request.setUsername("newuser");
        request.setEmail("existing@example.com");
        request.setPassword("password123");
        request.setRole("USER");
        request.setStatus("ACTIVE");

        // 第一次 selectCount 检查用户名（返回 0）
        // 第二次 selectCount 检查邮箱（返回 1）
        when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L).thenReturn(1L);

        // 执行测试并验证异常
        BusinessException exception = assertThrows(BusinessException.class,
                () -> adminUserService.createUser(request));
        assertEquals(409, exception.getCode());
        assertEquals("邮箱已存在", exception.getMessage());
    }

    @Test
    void updateUser_Success() {
        // 准备数据
        UserUpdateRequest request = new UserUpdateRequest();
        request.setUsername("updateduser");
        request.setEmail("updated@example.com");
        request.setRole("ADMIN");
        request.setStatus("ACTIVE");

        when(userMapper.selectById(1L)).thenReturn(testUser);
        when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        // 执行测试
        UserListResponse.UserDTO response = adminUserService.updateUser(1L, request);

        // 验证结果
        assertNotNull(response);
        assertEquals("updateduser", response.getUsername());
        assertEquals("updated@example.com", response.getEmail());
        assertEquals("ADMIN", response.getRole());
        assertEquals("ACTIVE", response.getStatus());

        verify(userMapper, times(1)).selectById(1L);
        verify(userMapper, times(2)).selectCount(any(LambdaQueryWrapper.class));
        verify(userMapper, times(1)).updateById(any(User.class));
    }

    @Test
    void updateUser_UserNotFound() {
        // 准备数据
        UserUpdateRequest request = new UserUpdateRequest();
        request.setUsername("updateduser");

        when(userMapper.selectById(999L)).thenReturn(null);

        // 执行测试并验证异常
        BusinessException exception = assertThrows(BusinessException.class,
                () -> adminUserService.updateUser(999L, request));
        assertEquals(404, exception.getCode());
        assertEquals("用户不存在", exception.getMessage());
    }

    @Test
    void deleteUser_Success() {
        // 准备数据
        when(userMapper.selectById(1L)).thenReturn(testUser);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        // 执行测试
        adminUserService.deleteUser(1L);

        // 验证结果
        assertEquals(1, testUser.getDeleted());
        verify(userMapper, times(1)).selectById(1L);
        verify(userMapper, times(1)).updateById(any(User.class));
    }

    @Test
    void deleteUser_UserNotFound() {
        when(userMapper.selectById(999L)).thenReturn(null);

        // 执行测试并验证异常
        BusinessException exception = assertThrows(BusinessException.class,
                () -> adminUserService.deleteUser(999L));
        assertEquals(404, exception.getCode());
        assertEquals("用户不存在", exception.getMessage());
    }

    @Test
    void toggleUserStatus_ActiveToDisabled() {
        // 准备数据
        when(userMapper.selectById(1L)).thenReturn(testUser);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        // 执行测试
        UserListResponse.UserDTO response = adminUserService.toggleUserStatus(1L);

        // 验证结果
        assertNotNull(response);
        assertEquals("DISABLED", response.getStatus());
        assertEquals(0, testUser.getStatus());
        verify(userMapper, times(1)).updateById(any(User.class));
    }

    @Test
    void toggleUserStatus_DisabledToActive() {
        // 准备数据
        testUser.setStatus(0);
        when(userMapper.selectById(1L)).thenReturn(testUser);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        // 执行测试
        UserListResponse.UserDTO response = adminUserService.toggleUserStatus(1L);

        // 验证结果
        assertNotNull(response);
        assertEquals("ACTIVE", response.getStatus());
        assertEquals(1, testUser.getStatus());
    }

    @Test
    void toggleUserStatus_UserNotFound() {
        when(userMapper.selectById(999L)).thenReturn(null);

        // 执行测试并验证异常
        BusinessException exception = assertThrows(BusinessException.class,
                () -> adminUserService.toggleUserStatus(999L));
        assertEquals(404, exception.getCode());
        assertEquals("用户不存在", exception.getMessage());
    }
}
