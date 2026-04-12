package com.caius.agent.module.auth.filter;

import com.caius.agent.common.util.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT 认证过滤器
 * 
 * 职责：
 * 1. 从请求头提取 JWT Token
 * 2. 验证 Token 有效性
 * 3. 解析用户信息并设置到 SecurityContext
 * 4. 转换角色格式：数据库 "ADMIN" → Spring Security "ROLE_ADMIN"
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Value("${jwt.prefix}")
    private String tokenPrefix;

    /**
     * ⭐ 修复：跳过 async dispatch 和 error dispatch，避免 SSE 异步回调和错误转发时重复执行 JWT 认证。
     */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return true;
    }

    @Override
    protected boolean shouldNotFilterErrorDispatch() {
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = getTokenFromRequest(request);

        if (StringUtils.hasText(token)) {
            try {
                Claims claims = jwtUtil.parseToken(token);
                Long userId = claims.get("userId", Long.class);
                String username = claims.getSubject();
                String role = claims.get("role", String.class);

                String authority = "ROLE_" + role;
                List<SimpleGrantedAuthority> authorities = List.of(
                        new SimpleGrantedAuthority(authority)
                );

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(userId, null, authorities);

                SecurityContextHolder.getContext().setAuthentication(authentication);

                log.debug("[JWT] 认证成功, userId={}, username={}, role={}, authority={}",
                        userId, username, role, authority);
            } catch (ExpiredJwtException e) {
                SecurityContextHolder.clearContext();
                request.setAttribute("jwt_error_code", "TOKEN_EXPIRED");
                request.setAttribute("jwt_error_message", "登录已过期，请重新登录");
                log.info("[JWT] Token 已过期, URI={}", request.getRequestURI());
            } catch (JwtException | IllegalArgumentException e) {
                SecurityContextHolder.clearContext();
                request.setAttribute("jwt_error_code", "TOKEN_INVALID");
                request.setAttribute("jwt_error_message", "登录信息无效，请重新登录");
                log.warn("[JWT] Token 无效, URI={}, error={}", request.getRequestURI(), e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(tokenPrefix)) {
            return bearerToken.substring(tokenPrefix.length());
        }
        return null;
    }
}
