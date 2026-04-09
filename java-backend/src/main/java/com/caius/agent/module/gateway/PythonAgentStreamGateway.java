package com.caius.agent.module.gateway;

import com.caius.agent.module.agent.model.SseEvent;
import com.caius.agent.module.agent.parser.SseLineParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.Map;

/**
 * Python Agent 流式网关
 * 负责调用 Python SSE 服务并流式返回数据
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PythonAgentStreamGateway {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${python-agent.stream-endpoint:/api/v1/chat/stream}")
    private String streamEndpoint;

    /**
     * 流式调用 Python Agent
     *
     * @param requestBody 请求体
     * @return SseEvent 流
     */
    public Flux<SseEvent> streamChat(Map<String, Object> requestBody) {
        log.info("[流式网关] 开始流式调用: endpoint={}, body={}", streamEndpoint, requestBody);

        return webClient.post()
                .uri(streamEndpoint)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnNext(line -> log.debug("[流式网关] 收到行: {}", line))
                .map(this::parseJsonToSseEvent)
                .doOnNext(event -> log.info("[流式网关] 解析到事件: event={}, data={}", event.getEvent(), event.getData()))
                .doOnError(error -> log.error("[流式网关] 流式调用异常", error));
    }

    /**
     * 将 JSON 字符串解析为 SseEvent
     * Python 服务返回的格式：
     * {"type": "chunk", "content": "...", ...}
     * {"type": "done", ...}
     */
    private SseEvent parseJsonToSseEvent(String json) {
        try {
            JsonNode jsonNode = objectMapper.readTree(json);
            String type = jsonNode.has("type") ? jsonNode.get("type").asText() : "message";
            
            // 将 type 映射为 event 名称
            String eventName = "message".equals(type) ? "message" : type;
            
            return SseEvent.builder()
                    .event(eventName)
                    .data(json)
                    .build();
        } catch (Exception e) {
            log.warn("[流式网关] 解析 JSON 失败，原始数据: {}", json);
            // 如果不是 JSON，直接作为 message 事件返回
            return SseEvent.builder()
                    .event("message")
                    .data(json)
                    .build();
        }
    }
}
