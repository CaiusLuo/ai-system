package com.caius.agent.module.auth.service;

import com.caius.agent.module.auth.dto.LoginRequest;
import com.caius.agent.module.auth.dto.RegisterRequest;

import java.util.Map;

/**
 * 认证服务接口
 */
public interface AuthService {

    /**
     * 用户登录
     */
    Map<String, Object> login(LoginRequest request);

    /**
     * 用户注册
     */
    void register(RegisterRequest request);
}
