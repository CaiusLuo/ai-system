package com.caius.agent.module.agent.config;

import com.caius.agent.common.exception.BusinessException;
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
 * 3. 维护会话和消息的归属关系，用于用户级别隔离
 * 4. 防止内存泄漏（任务结束后清理）
 */
@Slf4j
@Component
public class AbortManager {

    private final ConcurrentHashMap<String, AtomicBoolean> abortMap = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, ConversationAbortContext> conversationMessageMap = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> messageUserMap = new ConcurrentHashMap<>();

    private record ConversationAbortContext(Long userId, String messageId) {
    }

    public void createAbortFlag(String messageId) {
        AtomicBoolean existing = abortMap.putIfAbsent(messageId, new AtomicBoolean(false));
        if (existing != null) {
            log.warn("[AbortManager] messageId={} 已存在 abort 标记，可能被重复使用", messageId);
        } else {
            log.debug("[AbortManager] 创建 abort 标记, messageId={}", messageId);
        }
    }

    public void createAbortFlag(String messageId, Long conversationId) {
        createAbortFlag(messageId, null, conversationId);
    }

    public void createAbortFlag(String messageId, Long userId, Long conversationId) {
        createAbortFlag(messageId);
        if (userId != null) {
            messageUserMap.put(messageId, userId);
        }
        if (conversationId != null && userId != null) {
            conversationMessageMap.put(conversationId, new ConversationAbortContext(userId, messageId));
            log.debug("[AbortManager] 关联 userId={}, conversationId={}, messageId={}", userId, conversationId, messageId);
        }
    }

    public boolean shouldAbort(String messageId) {
        AtomicBoolean flag = abortMap.get(messageId);
        return flag != null && flag.get();
    }

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

    public boolean triggerAbort(String messageId, Long userId) {
        Long ownerUserId = messageUserMap.get(messageId);
        if (ownerUserId == null) {
            log.warn("[AbortManager] messageId={} 不存在归属信息（任务可能已结束）", messageId);
            return false;
        }
        if (!ownerUserId.equals(userId)) {
            throw new BusinessException(403, "无权中断该会话");
        }
        return triggerAbort(messageId);
    }

    public boolean triggerAbortByConversationId(Long conversationId) {
        ConversationAbortContext context = conversationMessageMap.get(conversationId);
        if (context == null) {
            log.warn("[AbortManager] 没有找到 conversationId 对应的活跃流, conversationId={}", conversationId);
            return false;
        }
        return triggerAbort(context.messageId());
    }

    public boolean triggerAbortByConversationId(Long conversationId, Long userId) {
        ConversationAbortContext context = conversationMessageMap.get(conversationId);
        if (context == null) {
            log.warn("[AbortManager] 没有找到 conversationId 对应的活跃流, conversationId={}", conversationId);
            return false;
        }
        if (!context.userId().equals(userId)) {
            throw new BusinessException(403, "无权中断该会话");
        }
        return triggerAbort(context.messageId());
    }

    public void cleanup(String messageId) {
        AtomicBoolean removed = abortMap.remove(messageId);
        if (removed != null) {
            log.debug("[AbortManager] 清理 abort 标记, messageId={}", messageId);
        } else {
            log.debug("[AbortManager] abort 标记已不存在（可能已被清理）, messageId={}", messageId);
        }

        messageUserMap.remove(messageId);
        conversationMessageMap.entrySet().removeIf(entry -> entry.getValue().messageId().equals(messageId));
    }

    public int getActiveCount() {
        return abortMap.size();
    }

    public int getActiveConversationCount() {
        return conversationMessageMap.size();
    }
}
