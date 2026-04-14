package com.caius.agent.module.auth.controller;

import com.caius.agent.common.result.Result;
import com.caius.agent.common.security.ClientIpResolver;
import com.caius.agent.common.util.JwtUtil;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.auth.dto.LoginRequest;
import com.caius.agent.module.auth.dto.RegisterRequest;
import com.caius.agent.module.auth.service.AuthService;
import com.caius.agent.module.auth.service.RegistrationRateLimitService;
import com.caius.agent.module.user.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 认证控制器
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final RegistrationRateLimitService registrationRateLimitService;
    private final ClientIpResolver clientIpResolver;
    private final UserMapper userMapper;

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        Map<String, Object> data = authService.login(request);
        return Result.success("登录成功", data);
    }

    @PostMapping("/register")
    public Result<String> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpServletRequest
    ) {
        String clientIp = clientIpResolver.resolve(httpServletRequest);
        registrationRateLimitService.checkRegisterAllowed(clientIp);
        authService.register(request);
        return Result.success("注册成功", null);
    }

    @GetMapping("/me")
    public Result<Map<String, Object>> me(
            @AuthenticationPrincipal Long userId,
            HttpServletRequest request
    ) {
        String token = extractToken(request);
        User user = userMapper.selectById(userId);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("userId", userId);
        data.put("username", user != null ? user.getUsername() : jwtUtil.getUsername(token));
        data.put("role", user != null ? user.getRole() : jwtUtil.getRole(token));
        if (user != null) {
            data.put("status", user.getStatus());
            data.put("statusText", user.getStatus() != null && user.getStatus() == 1 ? "ACTIVE" : "DISABLED");
        }
        data.put("expiresAt", jwtUtil.getExpirationTimestamp(token));
        data.put("expiresInSeconds", jwtUtil.getRemainingSeconds(token));
        data.put("expired", false);

        return Result.success(data);
    }

    private String extractToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return "";
        }
        return authorization.substring("Bearer ".length());
    }
}
