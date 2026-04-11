package com.caius.agent.module.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.user.dto.UserDTO;
import com.caius.agent.module.user.entity.User;
import com.caius.agent.module.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 用户服务实现
 */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDTO getUserById(Long userId) {
        // MyBatis-Plus 会自动过滤逻辑删除的数据
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        
        // 转换为 DTO（不包含密码字段）
        return convertToDTO(user);
    }

    @Override
    public void updateUser(Long userId, User user) {
        // MyBatis-Plus 会自动过滤逻辑删除的数据
        User existUser = userMapper.selectById(userId);
        if (existUser == null) {
            throw new BusinessException("用户不存在");
        }

        // 只允许更新部分字段
        if (StringUtils.hasText(user.getEmail())) {
            // 检查邮箱是否已被其他用户使用
            LambdaQueryWrapper<User> emailQuery = new LambdaQueryWrapper<>();
            emailQuery.eq(User::getEmail, user.getEmail())
                    .ne(User::getId, userId);
            if (userMapper.selectCount(emailQuery) > 0) {
                throw new BusinessException("邮箱已被使用");
            }
            existUser.setEmail(user.getEmail());
        }
        
        if (StringUtils.hasText(user.getPassword())) {
            // 密码需要加密
            existUser.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        
        if (StringUtils.hasText(user.getUsername())) {
            // 检查用户名是否已被其他用户使用
            LambdaQueryWrapper<User> usernameQuery = new LambdaQueryWrapper<>();
            usernameQuery.eq(User::getUsername, user.getUsername())
                    .ne(User::getId, userId);
            if (userMapper.selectCount(usernameQuery) > 0) {
                throw new BusinessException("用户名已被使用");
            }
            existUser.setUsername(user.getUsername());
        }

        userMapper.updateById(existUser);
    }
    
    /**
     * 转换为 DTO
     */
    private UserDTO convertToDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus())
                .statusText(user.getStatus() != null && user.getStatus() == 1 ? "ACTIVE" : "DISABLED")
                .build();
    }
}
