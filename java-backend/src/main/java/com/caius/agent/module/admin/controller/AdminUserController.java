package com.caius.agent.module.admin.controller;

import com.caius.agent.common.result.Result;
import com.caius.agent.module.admin.dto.UserCreateRequest;
import com.caius.agent.module.admin.dto.UserListRequest;
import com.caius.agent.module.admin.dto.UserListResponse;
import com.caius.agent.module.admin.dto.UserUpdateRequest;
import com.caius.agent.module.admin.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Admin 用户管理控制器
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    /**
     * 获取用户列表（分页+筛选）
     */
    @GetMapping
    public Result<UserListResponse> listUsers(@Valid UserListRequest request) {
        UserListResponse response = adminUserService.listUsers(request);
        return Result.success(response);
    }

    /**
     * 创建用户
     */
    @PostMapping
    public Result<UserListResponse.UserDTO> createUser(@Valid @RequestBody UserCreateRequest request) {
        UserListResponse.UserDTO user = adminUserService.createUser(request);
        return Result.success(user);
    }

    /**
     * 更新用户
     */
    @PutMapping("/{id}")
    public Result<UserListResponse.UserDTO> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UserUpdateRequest request) {
        UserListResponse.UserDTO user = adminUserService.updateUser(id, request);
        return Result.success(user);
    }

    /**
     * 删除用户
     */
    @DeleteMapping("/{id}")
    public Result<Void> deleteUser(@PathVariable Long id) {
        adminUserService.deleteUser(id);
        return Result.success();
    }

    /**
     * 切换用户状态
     */
    @PatchMapping("/{id}/toggle-status")
    public Result<UserListResponse.UserDTO> toggleUserStatus(@PathVariable Long id) {
        UserListResponse.UserDTO user = adminUserService.toggleUserStatus(id);
        return Result.success(user);
    }
}
