package com.caius.agent.module.gateway;

import com.caius.agent.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Python Agent 服务网关
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PythonAgentGateway {

    private final RestTemplate restTemplate;

    @Value("${python-agent.url}")
    private String pythonAgentUrl;

    @Value("${python-agent.chat-endpoint}")
    private String chatEndpoint;

    /**
     * 调用 Python Agent 聊天服务
     * 支持自动重试机制
     */
    @Retryable(
            retryFor = {RestClientException.class},
            maxAttempts = 3,
            backoff = @Backoff(delay = 1000)
    )
    public String chat(String message, String sessionId) {
        String url = pythonAgentUrl + chatEndpoint;

        Map<String, Object> requestBody = Map.of(
                "message", message,
                "session_id", sessionId
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            log.info("调用 Python Agent: url={}, message={}", url, message);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Object reply = response.getBody().get("reply");
                log.info("Python Agent 响应: {}", reply);
                return reply != null ? reply.toString() : "";
            } else {
                throw new BusinessException("Python Agent 服务异常");
            }
        } catch (RestClientException e) {
            log.error("调用 Python Agent 失败: {}", e.getMessage());
            throw new BusinessException("AI 服务调用失败，请稍后重试");
        }
    }
}
