package com.caius.agent.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 提取客户端 IP。
 *
 * 注意：
 * 1. 如果部署在 Nginx / 网关后，需要由代理统一清洗并覆盖转发头。
 * 2. 如果应用直接暴露公网，不能完全信任客户端自带的转发头。
 */
@Component
public class ClientIpResolver {

    private static final List<String> IP_HEADERS = List.of(
            "X-Forwarded-For",
            "X-Real-IP",
            "CF-Connecting-IP",
            "True-Client-IP"
    );

    public String resolve(HttpServletRequest request) {
        for (String header : IP_HEADERS) {
            String value = request.getHeader(header);
            if (!StringUtils.hasText(value)) {
                continue;
            }

            String candidate = value.split(",")[0].trim();
            if (StringUtils.hasText(candidate) && !"unknown".equalsIgnoreCase(candidate)) {
                return normalize(candidate);
            }
        }

        return normalize(request.getRemoteAddr());
    }

    private String normalize(String ip) {
        if (!StringUtils.hasText(ip)) {
            return "unknown";
        }

        if ("0:0:0:0:0:0:0:1".equals(ip) || "::1".equals(ip)) {
            return "127.0.0.1";
        }

        return ip.trim();
    }
}
