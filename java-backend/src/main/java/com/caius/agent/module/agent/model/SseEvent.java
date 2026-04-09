package com.caius.agent.module.agent.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SSE 事件数据模型
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SseEvent {

    /**
     * 事件类型：message / done / error / ping
     */
    private String event;

    /**
     * 事件 ID（如 index 或 final）
     */
    private String id;
    /**
     * 数据内容（JSON 字符串，透传）
     */
    private String data;
}
