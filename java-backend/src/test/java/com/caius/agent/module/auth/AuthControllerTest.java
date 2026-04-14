package com.caius.agent.module.auth;

import com.caius.agent.common.result.Result;
import com.caius.agent.common.security.ClientIpResolver;
import com.caius.agent.common.util.JwtUtil;
import com.caius.agent.dao.UserMapper;
import com.caius.agent.module.auth.controller.AuthController;
import com.caius.agent.module.auth.service.AuthService;
import com.caius.agent.module.auth.service.RegistrationRateLimitService;
import com.caius.agent.module.user.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;

@DisplayName("认证控制器测试")
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private RegistrationRateLimitService registrationRateLimitService;
    @Mock
    private ClientIpResolver clientIpResolver;
    @Mock
    private UserMapper userMapper;
    @Mock
    private HttpServletRequest request;

    @Test
    @DisplayName("/auth/me 优先返回数据库中的最新用户信息")
    void me_UsesLatestUserInfoFromDatabase() {
        AuthController controller = new AuthController(
                authService,
                jwtUtil,
                registrationRateLimitService,
                clientIpResolver,
                userMapper
        );

        User user = new User();
        user.setId(1L);
        user.setUsername("updatedName");
        user.setRole("ADMIN");
        user.setStatus(0);

        when(request.getHeader("Authorization")).thenReturn("Bearer token");
        when(userMapper.selectById(1L)).thenReturn(user);
        when(jwtUtil.getExpirationTimestamp("token")).thenReturn(1744360000000L);
        when(jwtUtil.getRemainingSeconds("token")).thenReturn(3600L);

        Result<Map<String, Object>> result = controller.me(1L, request);

        assertNotNull(result.getData());
        assertEquals("updatedName", result.getData().get("username"));
        assertEquals("ADMIN", result.getData().get("role"));
        assertEquals(0, result.getData().get("status"));
        assertEquals("DISABLED", result.getData().get("statusText"));
    }
}
