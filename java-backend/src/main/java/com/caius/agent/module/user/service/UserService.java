package com.caius.agent.module.user.service;

import com.caius.agent.module.user.entity.User;

/**
 * 用户服务接口
 */
public interface UserService {

    /**
     * 根据 ID 获取用户
     */
    User getUserById(Long userId);

    /**
     * 更新用户信息
     */
    void updateUser(Long userId, User user);
}
