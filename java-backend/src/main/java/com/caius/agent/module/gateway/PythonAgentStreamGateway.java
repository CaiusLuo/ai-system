package com.caius.agent.module.gateway;

import com.caius.agent.module.agent.model.SseEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Python Agent 流式网关
 *
 * 职责：
 * 1. 调用 Python SSE 服务
 * 2. 将 Python 返回的原始 JSON 标准化为前端期望的 SSEChunkData 格式
 *
 * 前端期望格式：
 * {
 *   type: 'chunk' | 'done' | 'error' | 'ping',
 *   content: string,
 *   index: number,
 *   reasoning?: string,
 *   info?: string,
 *   conversationId?: number
 * }
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
     * @return 标准化后的 SseEvent 流
     */
    public Flux<SseEvent> streamChat(Map<String, Object> requestBody) {
        log.info("[流式网关] 开始流式调用: endpoint={}, body={}", streamEndpoint, requestBody);

        // chunk 计数器（用于生成 index）
        AtomicInteger chunkIndex = new AtomicInteger(0);
        AtomicInteger totalEvents = new AtomicInteger(0);

        Flux<String> rawFlux = webClient.post()
                .uri(streamEndpoint)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(String.class);

        log.info("[流式网关] WebClient Flux 链构建完成, 等待 subscribe 触发");

        return rawFlux
                .doOnSubscribe(subscription -> log.info("[流式网关] ✅ HTTP 请求已发起, 已订阅 Python 服务流"))
                .doOnNext(line -> {
                    totalEvents.incrementAndGet();
                    log.debug("[流式网关] 收到行 (#{}) {}", totalEvents.get(), line);
                })
                .map(line -> normalizeSseData(line, chunkIndex))
                .doOnNext(event -> log.debug("[流式网关] 标准化事件: event={}, data={}", event.getEvent(), event.getData()))
                .doOnComplete(() -> log.info("[流式网关] Python 服务流正常结束, 总事件数={}", totalEvents.get()))
                .doOnCancel(() -> log.warn("[流式网关] Python 服务流被取消, 总事件数={}", totalEvents.get()))
                .doOnError(error -> log.error("[流式网关] ❌ Python 服务流异常, 总事件数={}, 错误={}", totalEvents.get(), error.getMessage(), error));
    }

    /**
     * 将 Python 返回的原始数据标准化为前端期望格式
     *
     * Python 可能返回：
     * 1. JSON 格式：{"type": "chunk", "content": "...", ...}
     * 2. SSE 格式原始行：event:xxx\ndata:xxx
     * 3. 纯文本
     */
    private SseEvent normalizeSseData(String rawLine, AtomicInteger chunkIndex) {
        // 尝试解析为 JSON
        try {
            JsonNode jsonNode = objectMapper.readTree(rawLine);
            return normalizeJsonEvent(jsonNode, chunkIndex);
        } catch (Exception e) {
            // 不是 JSON，可能是 SSE 原始格式或纯文本
            return normalizeRawEvent(rawLine, chunkIndex);
        }
    }

    /**
     * 标准化 JSON 事件（适配 v2 协议）
     *
     * v2 协议变化：
     * 1. 所有字段统一为 camelCase（conversationId 而非 conversation_id）
     * 2. 每个事件必带 messageId, userId, requestId
     * 3. 新增 start 事件
     * 4. done 事件新增 contentLength, chunkCount, timestamp
     * 5. error 事件新增 errorCode, timestamp
     */
    private SseEvent normalizeJsonEvent(JsonNode jsonNode, AtomicInteger chunkIndex) {
        try {
            String type = jsonNode.has("type") ? jsonNode.get("type").asText() : "chunk";
            ObjectNode normalized = objectMapper.createObjectNode();

            // 标准化 type 字段
            normalized.put("type", normalizeEventType(type));

            // ⭐ v2 协议：透传全链路追踪字段（所有事件都带）
            if (jsonNode.has("messageId")) {
                normalized.put("messageId", jsonNode.get("messageId").asText());
            }
            if (jsonNode.has("requestId")) {
                normalized.put("requestId", jsonNode.get("requestId").asText());
            }
            if (jsonNode.has("userId")) {
                normalized.put("userId", jsonNode.get("userId").asLong());
            }
            if (jsonNode.has("conversationId")) {
                normalized.put("conversationId", jsonNode.get("conversationId").asLong());
            } else if (jsonNode.has("conversation_id")) {
                // 向后兼容 v1 协议
                normalized.put("conversationId", jsonNode.get("conversation_id").asLong());
            }

            switch (type) {
                case "start":
                    // ⭐ v2 新增：流式开始事件
                    // { type: 'start', requestId, userId, conversationId, messageId, timestamp }
                    if (jsonNode.has("timestamp")) {
                        normalized.put("timestamp", jsonNode.get("timestamp").asLong());
                    }
                    break;

                case "chunk":
                case "message":
                case "content":
                    // chunk 事件
                    normalized.put("content", getSafeText(jsonNode, "content"));

                    // index 字段：优先使用 Python 返回的 v2 index
                    if (jsonNode.has("index")) {
                        normalized.put("index", jsonNode.get("index").asInt());
                    } else {
                        normalized.put("index", chunkIndex.getAndIncrement());
                    }

                    // reasoning 字段（思考模式）
                    if (jsonNode.has("reasoning")) {
                        normalized.put("reasoning", jsonNode.get("reasoning").asText());
                    } else if (jsonNode.has("thinking")) {
                        normalized.put("reasoning", jsonNode.get("thinking").asText());
                    }

                    // info 字段
                    if (jsonNode.has("info")) {
                        normalized.put("info", jsonNode.get("info").asText());
                    }
                    break;

                case "done":
                    // done 事件
                    if (jsonNode.has("info")) {
                        normalized.put("info", jsonNode.get("info").asText());
                    } else if (jsonNode.has("summary")) {
                        normalized.put("info", jsonNode.get("summary").asText());
                    } else if (jsonNode.has("title")) {
                        normalized.put("info", jsonNode.get("title").asText());
                    } else if (jsonNode.has("message")) {
                        normalized.put("info", jsonNode.get("message").asText());
                    }

                    // ⭐ v2 新增：完整性校验字段
                    if (jsonNode.has("contentLength")) {
                        normalized.put("contentLength", jsonNode.get("contentLength").asInt());
                    }
                    if (jsonNode.has("chunkCount")) {
                        normalized.put("chunkCount", jsonNode.get("chunkCount").asInt());
                    }
                    if (jsonNode.has("timestamp")) {
                        normalized.put("timestamp", jsonNode.get("timestamp").asLong());
                    }
                    break;

                case "error":
                    // error 事件
                    String errorMsg = getSafeText(jsonNode, "message");
                    if (errorMsg.isEmpty() && jsonNode.has("error")) {
                        errorMsg = jsonNode.get("error").asText();
                    }
                    normalized.put("message", errorMsg);

                    // ⭐ v2 新增：errorCode（区分 ABORTED 和 STREAM_ERROR）
                    if (jsonNode.has("errorCode")) {
                        normalized.put("errorCode", jsonNode.get("errorCode").asText());
                    }
                    if (jsonNode.has("index")) {
                        normalized.put("index", jsonNode.get("index").asInt());
                    }
                    if (jsonNode.has("timestamp")) {
                        normalized.put("timestamp", jsonNode.get("timestamp").asLong());
                    }
                    break;

                case "ping":
                    // ping 事件：{ type: 'ping' }
                    break;

                default:
                    // 未知类型，透传原始内容
                    normalized.put("content", jsonNode.toString());
                    break;
            }

            String eventType = normalized.get("type").asText();
            String jsonData = objectMapper.writeValueAsString(normalized);

            // 生成 SSE event ID（用于断线恢复）
            // v2 协议中 Python 已带 id，但这里仍用本地生成的 ID 保证有值
            String eventId = eventType + "-" + chunkIndex.get();
            if (jsonNode.has("messageId")) {
                eventId = eventType + "-" + jsonNode.get("messageId").asText();
            }

            return SseEvent.builder()
                    .event(eventType)
                    .id(eventId)
                    .data(jsonData)
                    .build();

        } catch (Exception e) {
            log.error("[流式网关] 标准化 JSON 事件失败: {}", jsonNode, e);
            return createFallbackEvent("error", "标准化失败: " + e.getMessage(), chunkIndex);
        }
    }

    /**
     * 标准化非 JSON 原始事件
     */
    private SseEvent normalizeRawEvent(String rawLine, AtomicInteger chunkIndex) {
        // 检查是否是 SSE 格式（event:xxx\ndata:xxx）
        if (rawLine.startsWith("event:") || rawLine.startsWith("data:")) {
            // SSE 原始格式，简单解析
            String content = rawLine.replaceFirst("^(event|data):\\s*", "").trim();
            return SseEvent.builder()
                    .event("chunk")
                    .id("chunk-" + chunkIndex.getAndIncrement())
                    .data("{\"type\":\"chunk\",\"content\":\"" + escapeJson(content) + "\",\"index\":" + chunkIndex.get() + "}")
                    .build();
        }

        // 纯文本，当作 chunk
        return SseEvent.builder()
                .event("chunk")
                .id("chunk-" + chunkIndex.getAndIncrement())
                .data("{\"type\":\"chunk\",\"content\":\"" + escapeJson(rawLine) + "\",\"index\":" + chunkIndex.get() + "}")
                .build();
    }

    /**
     * 标准化事件类型名称
     * Python 可能返回 "message" / "content"，统一转为 "chunk"
     */
    private String normalizeEventType(String type) {
        return switch (type.toLowerCase()) {
            case "message", "content" -> "chunk";
            default -> type;
        };
    }

    /**
     * 安全获取文本字段
     */
    private String getSafeText(JsonNode node, String fieldName) {
        if (node.has(fieldName) && !node.get(fieldName).isNull()) {
            return node.get(fieldName).asText("");
        }
        return "";
    }

    /**
     * JSON 字符串转义
     */
    private String escapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    /**
     * 创建兜底事件
     */
    private SseEvent createFallbackEvent(String type, String message, AtomicInteger chunkIndex) {
        try {
            ObjectNode errorNode = objectMapper.createObjectNode();
            errorNode.put("type", type);
            errorNode.put("message", message);
            errorNode.put("index", chunkIndex.get());

            return SseEvent.builder()
                    .event(type)
                    .id(type + "-" + chunkIndex.get())
                    .data(objectMapper.writeValueAsString(errorNode))
                    .build();
        } catch (Exception e) {
            return SseEvent.builder()
                    .event(type)
                    .data("{\"type\":\"" + type + "\",\"message\":\"unknown error\"}")
                    .build();
        }
    }
}
