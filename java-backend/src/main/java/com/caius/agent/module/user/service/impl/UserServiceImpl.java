package com.caius.agent.module.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.user.entity.User;
import com.caius.agent.module.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 用户服务实现
 */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;

    @Override
    public User getUserById(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        // 不返回密码
        user.setPassword(null);
        return user;
    }

    @Override
    public void updateUser(Long userId, User user) {
        User existUser = userMapper.selectById(userId);
        if (existUser == null) {
            throw new BusinessException("用户不存在");
        }

        // 只允许更新部分字段
        if (user.getEmail() != null) {
            existUser.setEmail(user.getEmail());
        }
        if (user.getPassword() != null) {
            existUser.setPassword(user.getPassword());
        }

        userMapper.updateById(existUser);
    }
}
