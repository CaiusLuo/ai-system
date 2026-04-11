package com.caius.agent.common.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JWT 工具类单元测试
 */
class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "testSecretKeyForJwtTokenGeneration2024AgentBackendSystem");
        ReflectionTestUtils.setField(jwtUtil, "expiration", 86400000L); // 24小时
    }

    @Test
    void generateToken_Success() {
        // 执行测试
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        // 验证结果
        assertNotNull(token);
        assertTrue(token.length() > 0);
    }

    @Test
    void parseToken_Success() {
        // 准备数据
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        // 执行测试
        var claims = jwtUtil.parseToken(token);

        // 验证结果
        assertNotNull(claims);
        assertEquals(1L, claims.get("userId", Long.class));
        assertEquals("testuser", claims.get("username", String.class));
        assertEquals("USER", claims.get("role", String.class));
    }

    @Test
    void getUserId_Success() {
        // 准备数据
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        // 执行测试
        Long userId = jwtUtil.getUserId(token);

        // 验证结果
        assertEquals(1L, userId);
    }

    @Test
    void getUsername_Success() {
        // 准备数据
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        // 执行测试
        String username = jwtUtil.getUsername(token);

        // 验证结果
        assertEquals("testuser", username);
    }

    @Test
    void getRole_Success() {
        // 准备数据
        String token = jwtUtil.generateToken(1L, "testuser", "ADMIN");

        // 执行测试
        String role = jwtUtil.getRole(token);

        // 验证结果
        assertEquals("ADMIN", role);
    }

    @Test
    void isTokenExpired_NotExpired() {
        // 准备数据
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        // 执行测试
        boolean expired = jwtUtil.isTokenExpired(token);

        // 验证结果（刚生成的 token 不应过期）
        assertFalse(expired);
    }

    @Test
    void validateToken_Valid() {
        // 准备数据
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        // 执行测试
        boolean valid = jwtUtil.validateToken(token);

        // 验证结果
        assertTrue(valid);
    }

    @Test
    void validateToken_Invalid() {
        // 执行测试（无效 token）
        boolean valid = jwtUtil.validateToken("invalid.token.here");

        // 验证结果
        assertFalse(valid);
    }

    @Test
    void validateToken_Empty() {
        // 执行测试（空 token）
        boolean valid = jwtUtil.validateToken("");

        // 验证结果
        assertFalse(valid);
    }

    @Test
    void tokenContainsCorrectClaims() {
        // 准备数据
        Long userId = 123L;
        String username = "admin";
        String role = "ADMIN";

        // 执行测试
        String token = jwtUtil.generateToken(userId, username, role);
        var claims = jwtUtil.parseToken(token);

        // 验证结果
        assertEquals(userId, claims.get("userId", Long.class));
        assertEquals(username, claims.getSubject());
        assertEquals(username, claims.get("username", String.class));
        assertEquals(role, claims.get("role", String.class));
        assertNotNull(claims.getIssuedAt());
        assertNotNull(claims.getExpiration());
    }

    @Test
    void getExpirationTimestamp_Success() {
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        long expirationTimestamp = jwtUtil.getExpirationTimestamp(token);

        assertTrue(expirationTimestamp > System.currentTimeMillis());
    }

    @Test
    void getRemainingSeconds_Success() {
        String token = jwtUtil.generateToken(1L, "testuser", "USER");

        long remainingSeconds = jwtUtil.getRemainingSeconds(token);

        assertTrue(remainingSeconds > 0);
        assertTrue(remainingSeconds <= 86400);
    }
}
