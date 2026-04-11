package com.caius.agent.module.agent.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * AbortManager 单元测试
 * 
 * 测试覆盖：
 * - 创建 abort 标记
 * - 触发 abort
 * - 检查 abort 状态
 * - 清理标记
 * - 并发安全性测试
 */
@DisplayName("AbortManager 测试")
class AbortManagerTest {

    private AbortManager abortManager;

    @BeforeEach

    void setUp() {
        abortManager = new AbortManager();
    }

    // ==================== 基本功能测试 ====================

    @Nested
    @DisplayName("基本功能测试")
    class BasicTests {

        @Test
        @DisplayName("创建 abort 标记")
        void createAbortFlag_Success() {
            // 执行测试
            abortManager.createAbortFlag("message-1");

            // 验证标记不存在（初始为 false）
            assertFalse(abortManager.shouldAbort("message-1"));
        }

        @Test
        @DisplayName("创建 abort 标记并关联 conversationId")
        void createAbortFlag_WithConversationId() {
            // 执行测试
            abortManager.createAbortFlag("message-1", 100L);

            // 验证标记存在
            assertFalse(abortManager.shouldAbort("message-1"));
        }

        @Test
        @DisplayName("触发 abort - 成功")
        void triggerAbort_Success() {
            // 准备数据
            abortManager.createAbortFlag("message-1");

            // 执行测试
            boolean result = abortManager.triggerAbort("message-1");

            // 验证结果
            assertTrue(result);
            assertTrue(abortManager.shouldAbort("message-1"));
        }

        @Test
        @DisplayName("触发 abort - 标记不存在")
        void triggerAbort_NotFound() {
            // 执行测试
            boolean result = abortManager.triggerAbort("non-existent");

            // 验证结果
            assertFalse(result);
        }

        @Test
        @DisplayName("通过 conversationId 触发 abort")
        void triggerAbortByConversationId_Success() {
            // 准备数据
            abortManager.createAbortFlag("message-1", 100L);

            // 执行测试
            boolean result = abortManager.triggerAbortByConversationId(100L);

            // 验证结果
            assertTrue(result);
            assertTrue(abortManager.shouldAbort("message-1"));
        }

        @Test
        @DisplayName("通过 conversationId 触发 abort - 不存在")
        void triggerAbortByConversationId_NotFound() {
            // 执行测试
            boolean result = abortManager.triggerAbortByConversationId(999L);

            // 验证结果
            assertFalse(result);
        }

        @Test
        @DisplayName("清理 abort 标记")
        void cleanup_Success() {
            // 准备数据
            abortManager.createAbortFlag("message-1", 100L);
            abortManager.triggerAbort("message-1");

            // 执行测试
            abortManager.cleanup("message-1");

            // 验证标记已被清理
            assertFalse(abortManager.shouldAbort("message-1"));
            assertEquals(0, abortManager.getActiveCount());
            assertEquals(0, abortManager.getActiveConversationCount());
        }
    }

    // ==================== 并发安全性测试 ====================

    @Nested
    @DisplayName("并发安全性测试")
    class ConcurrencyTests {

        @Test
        @DisplayName("并发触发 abort - 线程安全")
        void concurrentTriggerAbort() throws InterruptedException {
            // 准备数据
            int threadCount = 100;
            String messageId = "message-1";
            abortManager.createAbortFlag(messageId);

            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);
            AtomicInteger successCount = new AtomicInteger(0);
            AtomicInteger failCount = new AtomicInteger(0);

            // 并发触发 abort
            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        boolean result = abortManager.triggerAbort(messageId);
                        if (result) {
                            successCount.incrementAndGet();
                        } else {
                            failCount.incrementAndGet();
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            // 等待所有线程完成
            latch.await(5, TimeUnit.SECONDS);
            executor.shutdown();

            // 验证至少有一个成功
            assertTrue(successCount.get() >= 1);
            // 验证 abort 状态为 true
            assertTrue(abortManager.shouldAbort(messageId));
        }

        @Test
        @DisplayName("并发检查和设置 abort - 无竞态条件")
        void concurrentCheckAndSet() throws InterruptedException {
            // 准备数据
            int threadCount = 50;
            String messageId = "message-1";
            abortManager.createAbortFlag(messageId);

            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch endLatch = new CountDownLatch(threadCount);
            AtomicInteger checkedBeforeAbort = new AtomicInteger(0);

            // 所有线程同时开始检查和触发
            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        startLatch.await(); // 等待开始信号

                        // 检查当前状态
                        boolean wasAborted = abortManager.shouldAbort(messageId);
                        
                        // 触发 abort
                        abortManager.triggerAbort(messageId);

                        // 如果检查时还未 abort，说明存在竞态窗口
                        if (!wasAborted) {
                            checkedBeforeAbort.incrementAndGet();
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        endLatch.countDown();
                    }
                });
            }

            // 启动所有线程
            startLatch.countDown();
            
            // 等待完成
            endLatch.await(5, TimeUnit.SECONDS);
            executor.shutdown();

            // 验证最终状态
            assertTrue(abortManager.shouldAbort(messageId));
        }

        @Test
        @DisplayName("并发创建和清理 - 无内存泄漏")
        void concurrentCreateAndCleanup() throws InterruptedException {
            int threadCount = 100;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);

            // 并发创建和清理
            for (int i = 0; i < threadCount; i++) {
                final int index = i;
                executor.submit(() -> {
                    try {
                        String messageId = "message-" + index;
                        abortManager.createAbortFlag(messageId, (long) index);
                        abortManager.triggerAbort(messageId);
                        abortManager.cleanup(messageId);
                    } finally {
                        latch.countDown();
                    }
                });
            }

            // 等待所有线程完成
            latch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            // 验证所有标记都被清理
            assertEquals(0, abortManager.getActiveCount());
            assertEquals(0, abortManager.getActiveConversationCount());
        }
    }

    // ==================== 边界情况测试 ====================

    @Nested
    @DisplayName("边界情况测试")
    class EdgeCaseTests {

        @Test
        @DisplayName("重复创建同一 messageId")
        void duplicateCreate() {
            // 准备数据
            abortManager.createAbortFlag("message-1");

            // 重复创建（应该不抛异常）
            assertDoesNotThrow(() -> abortManager.createAbortFlag("message-1"));
        }

        @Test
        @DisplayName("清理不存在的标记")
        void cleanupNonExistent() {
            // 执行测试（不应该抛异常）
            assertDoesNotThrow(() -> abortManager.cleanup("non-existent"));
        }

        @Test
        @DisplayName("多次触发同一 messageId 的 abort")
        void multipleTriggerAbort() {
            // 准备数据
            abortManager.createAbortFlag("message-1");

            // 第一次触发
            assertTrue(abortManager.triggerAbort("message-1"));
            
            // 第二次触发（仍然成功，因为标记还在）
            assertTrue(abortManager.triggerAbort("message-1"));
            
            // 验证状态
            assertTrue(abortManager.shouldAbort("message-1"));
        }

        @Test
        @DisplayName("清理后无法触发 abort")
        void triggerAfterCleanup() {
            // 准备数据
            abortManager.createAbortFlag("message-1");
            abortManager.cleanup("message-1");

            // 执行测试
            boolean result = abortManager.triggerAbort("message-1");

            // 验证结果
            assertFalse(result);
        }
    }
}
