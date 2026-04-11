package com.caius.agent.module.agent.service;

import com.caius.agent.module.agent.dto.StreamChatRequest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 流式聊天服务接口
 */
public interface StreamChatService {

    /**
     * 流式对话
     *
     * @param userId 用户 ID
     * @param request 请求参数
     * @return SSE 发射器
     */
    SseEmitter streamChat(Long userId, StreamChatRequest request);

    /**
     * 断线恢复：从 Redis 读取并 replay chunk
     *
     * @param conversationId 会话 ID
     * @param messageId      消息 ID（UUID）
     * @param lastEventId    最后接收到的事件 ID（可选）
     * @param emitter        SSE 发射器
     */
    void recoverChunks(Long conversationId, String messageId, String lastEventId, SseEmitter emitter);

    /**
     * 中断流式生成
     *
     * @param messageId 消息 ID（UUID）
     * @return true = 成功中断, false = 任务已结束或不存在
     */
    boolean abortStream(String messageId);

    /**
     * 通过 conversationId 中断流式生成
     *
     * @param conversationId 会话 ID
     * @return true = 成功中断, false = 任务已结束或不存在
     */
    boolean abortStreamByConversationId(Long conversationId);
}
