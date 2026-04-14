package com.caius.agent.module.admin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.admin.dto.UserCreateRequest;
import com.caius.agent.module.admin.dto.UserListRequest;
import com.caius.agent.module.admin.dto.UserListResponse;
import com.caius.agent.module.admin.dto.UserUpdateRequest;
import com.caius.agent.module.admin.service.AdminUserService;
import com.caius.agent.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Admin 用户服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    @Override
    public UserListResponse listUsers(UserListRequest request) {
        // 参数校验和默认值处理
        int page = request.getPage() != null && request.getPage() > 0 ? request.getPage() : 1;
        int pageSize = request.getPageSize() != null && request.getPageSize() > 0 ? request.getPageSize() : 10;
        // 限制最大 pageSize
        pageSize = Math.min(pageSize, 100);

        // 构建查询条件（MyBatis-Plus 会自动过滤逻辑删除的数据）
        LambdaQueryWrapper<User> queryWrapper = new LambdaQueryWrapper<>();

        // 关键词搜索（匹配用户名或邮箱）
        if (StringUtils.hasText(request.getKeyword())) {
            queryWrapper.and(wrapper -> wrapper
                    .like(User::getUsername, request.getKeyword())
                    .or()
                    .like(User::getEmail, request.getKeyword())
            );
        }

        // 角色筛选
        if (StringUtils.hasText(request.getRole())) {
            queryWrapper.eq(User::getRole, request.getRole().toUpperCase());
        }

        // 状态筛选
        if (StringUtils.hasText(request.getStatus())) {
            Integer statusValue = "ACTIVE".equals(request.getStatus().toUpperCase()) ? 1 : 0;
            queryWrapper.eq(User::getStatus, statusValue);
        }

        queryWrapper.orderByDesc(User::getCreatedAt);

        // 分页查询
        Page<User> pageParam = new Page<>(page, pageSize);
        Page<User> userPage = userMapper.selectPage(pageParam, queryWrapper);

        // 转换为 DTO
        List<UserListResponse.UserDTO> dtoList = userPage.getRecords().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return UserListResponse.builder()
                .list(dtoList)
                .total(userPage.getTotal())
                .page(page)
                .pageSize(pageSize)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserListResponse.UserDTO createUser(UserCreateRequest request) {
        // 校验角色
        if (!"ADMIN".equals(request.getRole()) && !"USER".equals(request.getRole())) {
            throw new BusinessException(400, "角色只能是 ADMIN 或 USER");
        }

        // 校验状态
        if (!"ACTIVE".equals(request.getStatus()) && !"DISABLED".equals(request.getStatus())) {
            throw new BusinessException(400, "状态只能是 ACTIVE 或 DISABLED");
        }

        // 检查用户名是否已存在（MyBatis-Plus 会自动过滤逻辑删除的数据）
        LambdaQueryWrapper<User> usernameQuery = new LambdaQueryWrapper<>();
        usernameQuery.eq(User::getUsername, request.getUsername());
        if (userMapper.selectCount(usernameQuery) > 0) {
            throw new BusinessException(409, "用户名已存在");
        }

        // 检查邮箱是否已存在
        LambdaQueryWrapper<User> emailQuery = new LambdaQueryWrapper<>();
        emailQuery.eq(User::getEmail, request.getEmail());
        if (userMapper.selectCount(emailQuery) > 0) {
            throw new BusinessException(409, "邮箱已存在");
        }

        // 创建用户
        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole().toUpperCase());
        user.setStatus("ACTIVE".equals(request.getStatus().toUpperCase()) ? 1 : 0);

        userMapper.insert(user);

        log.info("创建用户成功: id={}, username={}", user.getId(), user.getUsername());

        return convertToDTO(user);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserListResponse.UserDTO updateUser(Long id, UserUpdateRequest request) {
        User existUser = userMapper.selectById(id);
        if (existUser == null) {
            throw new BusinessException(404, "用户不存在");
        }

        // 校验角色（如果提供）
        if (StringUtils.hasText(request.getRole())) {
            if (!"ADMIN".equals(request.getRole()) && !"USER".equals(request.getRole())) {
                throw new BusinessException(400, "角色只能是 ADMIN 或 USER");
            }
            existUser.setRole(request.getRole().toUpperCase());
        }

        // 校验状态（如果提供）
        if (StringUtils.hasText(request.getStatus())) {
            if (!"ACTIVE".equals(request.getStatus()) && !"DISABLED".equals(request.getStatus())) {
                throw new BusinessException(400, "状态只能是 ACTIVE 或 DISABLED");
            }
            existUser.setStatus("ACTIVE".equals(request.getStatus().toUpperCase()) ? 1 : 0);
        }

        // 更新用户名（如果提供）
        if (StringUtils.hasText(request.getUsername())) {
            // 检查新用户名是否已被其他用户使用
            LambdaQueryWrapper<User> usernameQuery = new LambdaQueryWrapper<>();
            usernameQuery.eq(User::getUsername, request.getUsername())
                    .eq(User::getDeleted, 0)
                    .ne(User::getId, id);
            if (userMapper.selectCount(usernameQuery) > 0) {
                throw new BusinessException(409, "用户名已存在");
            }
            existUser.setUsername(request.getUsername());
        }

        // 更新邮箱（如果提供）
        if (StringUtils.hasText(request.getEmail())) {
            // 检查新邮箱是否已被其他用户使用
            LambdaQueryWrapper<User> emailQuery = new LambdaQueryWrapper<>();
            emailQuery.eq(User::getEmail, request.getEmail())
                    .eq(User::getDeleted, 0)
                    .ne(User::getId, id);
            if (userMapper.selectCount(emailQuery) > 0) {
                throw new BusinessException(409, "邮箱已存在");
            }
            existUser.setEmail(request.getEmail());
        }

        // 更新密码（如果提供）
        if (StringUtils.hasText(request.getPassword())) {
            existUser.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        userMapper.updateById(existUser);

        log.info("更新用户成功: id={}, username={}", id, existUser.getUsername());

        return convertToDTO(existUser);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long id) {
        User existUser = userMapper.selectById(id);
        if (existUser == null) {
            throw new BusinessException(404, "用户不存在");
        }

        // 使用 MyBatis-Plus 的逻辑删除（会自动设置 deleted=1）
        userMapper.deleteById(id);

        log.info("删除用户成功: id={}, username={}", id, existUser.getUsername());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserListResponse.UserDTO toggleUserStatus(Long id) {
        User existUser = userMapper.selectById(id);
        if (existUser == null || existUser.getDeleted() == 1) {
            throw new BusinessException(404, "用户不存在");
        }

        // 切换状态（1 -> 0, 0 -> 1）
        existUser.setStatus(existUser.getStatus() == 1 ? 0 : 1);
        userMapper.updateById(existUser);

        log.info("切换用户状态成功: id={}, username={}, status={}",
                id, existUser.getUsername(), existUser.getStatus() == 1 ? "ACTIVE" : "DISABLED");

        return convertToDTO(existUser);
    }

    /**
     * 转换为 DTO（隐藏密码）
     */
    private UserListResponse.UserDTO convertToDTO(User user) {
        return UserListResponse.UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus() == 1 ? "ACTIVE" : "DISABLED")
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().format(ISO_FORMATTER) + "Z" : null)
                .build();
    }
}
