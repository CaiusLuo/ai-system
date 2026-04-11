package com.caius.agent.module.auth.service;

import com.caius.agent.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 注册接口限流，防止单 IP 大量创建账号。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationRateLimitService {

    private static final DateTimeFormatter HOUR_BUCKET = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final DateTimeFormatter DAY_BUCKET = DateTimeFormatter.BASIC_ISO_DATE;

    private final StringRedisTemplate redisTemplate;

    @Value("${auth.rate-limit.register-per-hour:5}")
    private int registerPerHour;

    @Value("${auth.rate-limit.register-per-day:20}")
    private int registerPerDay;

    public void checkRegisterAllowed(String clientIp) {
        long hourCount = incrementBucket(
                "auth:register:ip:hour:" + clientIp + ":" + LocalDateTime.now().format(HOUR_BUCKET),
                Duration.ofHours(2)
        );
        if (hourCount > registerPerHour) {
            log.warn("[Auth] 注册频率超限（小时）, ip={}, count={}, limit={}",
                    clientIp, hourCount, registerPerHour);
            throw new BusinessException(429, "注册过于频繁，请1小时后再试");
        }

        long dayCount = incrementBucket(
                "auth:register:ip:day:" + clientIp + ":" + LocalDate.now().format(DAY_BUCKET),
                Duration.ofDays(2)
        );
        if (dayCount > registerPerDay) {
            log.warn("[Auth] 注册频率超限（天）, ip={}, count={}, limit={}",
                    clientIp, dayCount, registerPerDay);
            throw new BusinessException(429, "当天注册次数过多，请明天再试");
        }
    }

    private long incrementBucket(String key, Duration ttl) {
        Long current = redisTemplate.opsForValue().increment(key);
        if (current == null) {
            throw new BusinessException("注册限流检查失败，请稍后重试");
        }

        if (current == 1L) {
            redisTemplate.expire(key, ttl);
        }

        return current;
    }
}
