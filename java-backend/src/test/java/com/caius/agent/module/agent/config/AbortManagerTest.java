package com.caius.agent.module.agent.config;

import com.caius.agent.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("AbortManager 测试")
class AbortManagerTest {

    private AbortManager abortManager;

    @BeforeEach
    void setUp() {
        abortManager = new AbortManager();
    }

    @Test
    @DisplayName("用户本人可以按 messageId 中断")
    void triggerAbort_WithOwner_Success() {
        abortManager.createAbortFlag("message-1", 1L, 100L);

        boolean result = abortManager.triggerAbort("message-1", 1L);

        assertTrue(result);
        assertTrue(abortManager.shouldAbort("message-1"));
    }

    @Test
    @DisplayName("非所有者按 messageId 中断返回 403")
    void triggerAbort_WithOtherUser_ShouldThrow403() {
        abortManager.createAbortFlag("message-1", 1L, 100L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> abortManager.triggerAbort("message-1", 2L));

        assertEquals(403, exception.getCode());
        assertEquals("无权中断该会话", exception.getMessage());
    }

    @Test
    @DisplayName("用户本人可以按 conversationId 中断")
    void triggerAbortByConversationId_WithOwner_Success() {
        abortManager.createAbortFlag("message-1", 1L, 100L);

        boolean result = abortManager.triggerAbortByConversationId(100L, 1L);

        assertTrue(result);
        assertTrue(abortManager.shouldAbort("message-1"));
    }

    @Test
    @DisplayName("非所有者按 conversationId 中断返回 403")
    void triggerAbortByConversationId_WithOtherUser_ShouldThrow403() {
        abortManager.createAbortFlag("message-1", 1L, 100L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> abortManager.triggerAbortByConversationId(100L, 2L));

        assertEquals(403, exception.getCode());
        assertEquals("无权中断该会话", exception.getMessage());
    }

    @Test
    @DisplayName("清理会同时移除所有权映射")
    void cleanup_ShouldRemoveOwnershipMappings() {
        abortManager.createAbortFlag("message-1", 1L, 100L);

        abortManager.cleanup("message-1");

        assertFalse(abortManager.shouldAbort("message-1"));
        assertEquals(0, abortManager.getActiveCount());
        assertEquals(0, abortManager.getActiveConversationCount());
        assertFalse(abortManager.triggerAbort("message-1", 1L));
    }

    @Test
    @DisplayName("并发触发内部 abort 保持线程安全")
    void concurrentTriggerAbort_ShouldBeThreadSafe() throws InterruptedException {
        int threadCount = 50;
        String messageId = "message-1";
        abortManager.createAbortFlag(messageId, 1L, 100L);

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    if (abortManager.triggerAbort(messageId)) {
                        successCount.incrementAndGet();
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(successCount.get() >= 1);
        assertTrue(abortManager.shouldAbort(messageId));
    }
}
