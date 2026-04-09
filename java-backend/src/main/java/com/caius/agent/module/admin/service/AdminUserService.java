package com.caius.agent.module.admin.service;

import com.caius.agent.module.admin.dto.UserCreateRequest;
import com.caius.agent.module.admin.dto.UserListRequest;
import com.caius.agent.module.admin.dto.UserListResponse;
import com.caius.agent.module.admin.dto.UserUpdateRequest;

/**
 * Admin 用户服务接口
 */
public interface AdminUserService {

    /**
     * 分页查询用户列表
     */
    UserListResponse listUsers(UserListRequest request);

    /**
     * 创建用户
     */
    UserListResponse.UserDTO createUser(UserCreateRequest request);

    /**
     * 更新用户
     */
    UserListResponse.UserDTO updateUser(Long id, UserUpdateRequest request);

    /**
     * 删除用户
     */
    void deleteUser(Long id);

    /**
     * 切换用户状态
     */
    UserListResponse.UserDTO toggleUserStatus(Long id);
}
