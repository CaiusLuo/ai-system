"""Abort 控制器测试"""
import pytest
import asyncio
from agent.core.abort import AbortController


class TestAbortController:
    """测试 AbortController 类"""

    def test_initial_state_not_aborted(self):
        """测试初始状态未中断"""
        controller = AbortController()
        assert controller.is_aborted(1) is False
        assert controller.is_aborted("test-id") is False

    def test_abort_with_int_key(self):
        """测试使用 int key 中断"""
        controller = AbortController()
        controller.abort(123)
        assert controller.is_aborted(123) is True
        assert controller.is_aborted(456) is False  # 其他 key 不受影响

    def test_abort_with_str_key(self):
        """测试使用 str key 中断"""
        controller = AbortController()
        controller.abort("message-uuid-123")
        assert controller.is_aborted("message-uuid-123") is True
        assert controller.is_aborted("other-uuid") is False

    def test_clear_removes_flag(self):
        """测试清除后标志移除"""
        controller = AbortController()
        controller.abort(123)
        assert controller.is_aborted(123) is True

        controller.clear(123)
        assert controller.is_aborted(123) is False

    def test_clear_nonexistent_key(self):
        """测试清除不存在的 key 不报错"""
        controller = AbortController()
        controller.clear(999)  # 应该不抛出异常
        assert controller.is_aborted(999) is False

    def test_multiple_aborts_same_key(self):
        """测试多次中断同一 key"""
        controller = AbortController()
        controller.abort(123)
        controller.abort(123)  # 多次调用应正常工作
        assert controller.is_aborted(123) is True

    def test_mixed_key_types(self):
        """测试混合使用 int 和 str key"""
        controller = AbortController()
        controller.abort(123)
        controller.abort("msg-456")

        assert controller.is_aborted(123) is True
        assert controller.is_aborted("msg-456") is True
        assert controller.is_aborted(789) is False
        assert controller.is_aborted("msg-789") is False
