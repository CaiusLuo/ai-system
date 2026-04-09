package com.caius.agent.module.agent.parser;

import com.caius.agent.module.agent.model.SseEvent;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;
import reactor.util.concurrent.Queues;

import java.util.ArrayList;
import java.util.List;

/**
 * SSE 行解析器
 * 将原始文本流解析为 SseEvent 流
 *
 * 格式示例：
 * event: message
 * id: 0
 * data: {"type":"chunk","content":"你好"}
 *
 * event: done
 * id: final
 * data: {"type":"done"}
 */
@Slf4j
public class SseLineParser {

    private static final String EVENT_PREFIX = "event:";
    private static final String ID_PREFIX = "id:";
    private static final String DATA_PREFIX = "data:";

    /**
     * 将原始文本 Flux 解析为 SseEvent Flux
     *
     * @param rawFlux 原始文本流
     * @return SseEvent 流
     */
    public static Flux<SseEvent> parse(Flux<String> rawFlux) {
        return Flux.create(sink -> {
            StringBuilder buffer = new StringBuilder();

            rawFlux.doOnNext(chunk -> {
                        log.debug("[SSE Parser] 收到原始数据: {}", chunk);
                        buffer.append(chunk);
                        processBuffer(buffer, sink);
                    })
                    .doOnError(error -> {
                        log.error("[SSE Parser] 解析异常", error);
                        sink.error(error);
                    })
                    .doOnComplete(() -> {
                        // 处理缓冲区剩余数据
                        processRemaining(buffer, sink);
                        sink.complete();
                    })
                    .subscribe();
        }, reactor.core.publisher.FluxSink.OverflowStrategy.BUFFER);
    }

    private static void processBuffer(StringBuilder buffer, reactor.core.publisher.FluxSink<SseEvent> sink) {
        String content = buffer.toString();

        // 查找完整的事件边界（空行分隔）
        int lastEventEnd = content.lastIndexOf("\n\n");
        if (lastEventEnd <= 0) {
            return; // 没有完整的事件
        }

        String completePart = content.substring(0, lastEventEnd);
        String remainingPart = content.substring(lastEventEnd + 2);

        // 解析完整的事件
        parseEvents(completePart, sink);

        // 保留未完成的部分
        buffer.setLength(0);
        buffer.append(remainingPart);
    }

    private static void parseEvents(String content, reactor.core.publisher.FluxSink<SseEvent> sink) {
        String[] lines = content.split("\\r?\\n");

        String currentEvent = null;
        String currentId = null;
        StringBuilder currentData = new StringBuilder();

        for (String line : lines) {
            line = line.trim();

            if (line.isEmpty()) {
                // 空行表示一个事件结束
                if (currentEvent != null || currentData.length() > 0) {
                    SseEvent sseEvent = SseEvent.builder()
                            .event(currentEvent != null ? currentEvent : "message")
                            .id(currentId)
                            .data(currentData.toString().trim())
                            .build();

                    log.info("[SSE Parser] 解析到事件: event={}, id={}, data={}",
                            sseEvent.getEvent(), sseEvent.getId(), sseEvent.getData());

                    sink.next(sseEvent);

                    // 重置
                    currentEvent = null;
                    currentId = null;
                    currentData = new StringBuilder();
                }
                continue;
            }

            if (line.startsWith(EVENT_PREFIX)) {
                currentEvent = line.substring(EVENT_PREFIX.length()).trim();
            } else if (line.startsWith(ID_PREFIX)) {
                currentId = line.substring(ID_PREFIX.length()).trim();
            } else if (line.startsWith(DATA_PREFIX)) {
                if (currentData.length() > 0) {
                    currentData.append("\n");
                }
                currentData.append(line.substring(DATA_PREFIX.length()).trim());
            }
        }
    }

    private static void processRemaining(StringBuilder buffer, reactor.core.publisher.FluxSink<SseEvent> sink) {
        String content = buffer.toString().trim();
        if (!content.isEmpty()) {
            parseEvents(content, sink);
        }
    }
}
