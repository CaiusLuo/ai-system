package com.caius.agent.module.agent.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Abort 管理器
 * 
 * 职责：
 * 1. 管理所有活跃流式任务的 abort 状态
 * 2. 提供线程安全的 abort 标记设置和查询
 * 3. 维护 conversationId -> messageId 映射（用于 RESTful 接口）
 * 4. 防止内存泄漏（任务结束后清理）
 * 
 * 线程安全：使用 ConcurrentHashMap 保证并发安全
 */
@Slf4j
@Component
public class AbortManager {

    /**
     * 全局 abort 映射表
     * Key: messageId (UUID)
     * Value: AtomicBoolean (true = 需要中断)
     */
    private final ConcurrentHashMap<String, AtomicBoolean> abortMap = new ConcurrentHashMap<>();

    /**
     * conversationId -> messageId 映射
     * 用于通过 conversationId 查找对应的 messageId
     */
    private final ConcurrentHashMap<Long, String> conversationMessageMap = new ConcurrentHashMap<>();

    /**
     * 创建 abort 标记（任务开始时调用）
     * 
     * @param messageId 消息唯一标识
     */
    public void createAbortFlag(String messageId) {
        AtomicBoolean existing = abortMap.putIfAbsent(messageId, new AtomicBoolean(false));
        if (existing != null) {
            log.warn("[AbortManager] messageId={} 已存在 abort 标记，可能被重复使用", messageId);
        } else {
            log.debug("[AbortManager] 创建 abort 标记, messageId={}", messageId);
        }
    }

    /**
     * 创建 abort 标记并关联 conversationId
     * 
     * @param messageId 消息唯一标识
     * @param conversationId 会话 ID
     */
    public void createAbortFlag(String messageId, Long conversationId) {
        createAbortFlag(messageId);
        if (conversationId != null) {
            conversationMessageMap.put(conversationId, messageId);
            log.debug("[AbortManager] 关联 conversationId={}, messageId={}", conversationId, messageId);
        }
    }

    /**
     * 检查是否应该 abort
     * 
     * @param messageId 消息唯一标识
     * @return true = 需要中断, false = 继续执行
     */
    public boolean shouldAbort(String messageId) {
        AtomicBoolean flag = abortMap.get(messageId);
        return flag != null && flag.get();
    }

    /**
     * 触发 abort（由 abort 接口调用）
     * 
     * @param messageId 消息唯一标识
     * @return true = 成功设置, false = 标记不存在（可能任务已结束）
     */
    public boolean triggerAbort(String messageId) {
        AtomicBoolean flag = abortMap.get(messageId);
        if (flag == null) {
            log.warn("[AbortManager] abort 标记不存在, messageId={}（任务可能已结束）", messageId);
            return false;
        }
        flag.set(true);
        log.info("[AbortManager] 触发 abort, messageId={}", messageId);
        return true;
    }

    /**
     * 通过 conversationId 触发 abort
     * 
     * @param conversationId 会话 ID
     * @return true = 成功设置, false = 没有找到活跃流
     */
    public boolean triggerAbortByConversationId(Long conversationId) {
        String messageId = conversationMessageMap.get(conversationId);
        if (messageId == null) {
            log.warn("[AbortManager] 没有找到 conversationId 对应的活跃流, conversationId={}", conversationId);
            return false;
        }
        return triggerAbort(messageId);
    }

    /**
     * 清理 abort 标记（任务结束或中断后调用）
     * 
     * @param messageId 消息唯一标识
     */
    public void cleanup(String messageId) {
        AtomicBoolean removed = abortMap.remove(messageId);
        if (removed != null) {
            log.debug("[AbortManager] 清理 abort 标记, messageId={}", messageId);
        } else {
            log.debug("[AbortManager] abort 标记已不存在（可能已被清理）, messageId={}", messageId);
        }

        // 同时清理 conversationMessageMap
        conversationMessageMap.entrySet().removeIf(entry -> 
            entry.getValue().equals(messageId)
        );
    }

    /**
     * 获取当前活跃的 abort 标记数量（用于监控）
     */
    public int getActiveCount() {
        return abortMap.size();
    }

    /**
     * 获取当前活跃的 conversation 数量（用于监控）
     */
    public int getActiveConversationCount() {
        return conversationMessageMap.size();
    }
}
