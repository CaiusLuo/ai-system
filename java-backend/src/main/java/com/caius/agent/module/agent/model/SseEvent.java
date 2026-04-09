package com.caius.agent.module.agent.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SSE 事件数据模型
 *
 * 与前端 SSEChunkData 接口对齐：
 * {
 *   type: 'chunk' | 'done' | 'error' | 'ping',
 *   content: string,
 *   index: number,
 *   reasoning?: string,
 *   info?: string,
 *   conversationId?: number
 * }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SseEvent {

    /**
     * 事件类型：chunk / done / error / ping
     */
    private String event;

    /**
     * 事件 ID（SSE Last-Event-Id，用于断线恢复）
     */
    private String id;

    /**
     * 数据内容（JSON 字符串，已标准化为前端期望格式）
     */
    private String data;
}
