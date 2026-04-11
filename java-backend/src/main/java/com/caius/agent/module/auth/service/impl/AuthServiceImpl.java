package com.caius.agent.module.auth.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.common.util.JwtUtil;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.auth.dto.LoginRequest;
import com.caius.agent.module.auth.dto.RegisterRequest;
import com.caius.agent.module.auth.service.AuthService;
import com.caius.agent.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 认证服务实现
 */
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Override
    public Map<String, Object> login(LoginRequest request) {
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.getUsername())
        );

        if (user == null) {
            throw new BusinessException("用户不存在");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("密码错误");
        }

        if (user.getStatus() != 1) {
            throw new BusinessException("用户已被禁用");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        result.put("role", user.getRole());
        result.put("expiresAt", jwtUtil.getExpirationTimestamp(token));
        result.put("expiresInSeconds", jwtUtil.getRemainingSeconds(token));

        return result;
    }

    @Override
    public void register(RegisterRequest request) {
        // 检查用户名是否存在
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.getUsername())
        );
        if (count > 0) {
            throw new BusinessException("用户名已存在");
        }

        // 检查邮箱是否存在
        count = userMapper.selectCount(
                new LambdaQueryWrapper<User>()
                        .eq(User::getEmail, request.getEmail())
        );
        if (count > 0) {
            throw new BusinessException("邮箱已存在");
        }

        // 创建用户
        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole("USER");
        user.setStatus(1);

        userMapper.insert(user);
    }
}
