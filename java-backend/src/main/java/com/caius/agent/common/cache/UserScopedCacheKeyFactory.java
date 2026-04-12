package com.caius.agent.common.cache;

import org.springframework.stereotype.Component;

/**
 * 统一生成带用户前缀的缓存键，避免跨用户缓存污染。
 */
@Component
public class UserScopedCacheKeyFactory {

    public String conversationMessages(Long userId, Long conversationId) {
        return "user:" + userId + ":conversation:messages:" + conversationId;
    }

    public String streamChunks(Long userId, Long conversationId, String messageId) {
        return "user:" + userId + ":stream:" + conversationId + ":" + messageId;
    }
}
