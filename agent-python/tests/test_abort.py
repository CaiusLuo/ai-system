"""Abort 控制器测试"""
import time
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

    def test_ttl_expiration(self):
        """测试 TTL 过期自动清理"""
        # 使用极短 TTL 测试过期逻辑（10ms）
        controller = AbortController(ttl=0.01)
        controller.abort(123)
        assert controller.is_aborted(123) is True

        # 等待 TTL 过期
        time.sleep(0.02)

        # 过期后应返回 False
        assert controller.is_aborted(123) is False

    def test_ttl_does_not_affect_other_keys(self):
        """测试 TTL 过期不影响其他 key"""
        controller = AbortController(ttl=0.01)
        controller.abort(123)
        controller.abort("msg-456")

        time.sleep(0.02)

        # 123 过期
        assert controller.is_aborted(123) is False
        # msg-456 也过期（同时创建）
        assert controller.is_aborted("msg-456") is False

        # 新建一个未过期的 key（在过期后创建，时间戳是新的）
        controller.abort("msg-789")
        # 立即检查，应未过期
        assert controller.is_aborted("msg-789") is True
        # 等过期
        time.sleep(0.02)
        assert controller.is_aborted("msg-789") is False

    def test_size_method(self):
        """测试 size 方法"""
        controller = AbortController()
        assert controller.size() == 0

        controller.abort(1)
        controller.abort(2)
        controller.abort("msg-3")
        assert controller.size() == 3

        controller.clear(1)
        assert controller.size() == 2

    def test_ttl_with_active_key(self):
        """测试 TTL 不立即影响未过期的 key"""
        controller = AbortController(ttl=60)  # 1 分钟 TTL
        controller.abort("msg-test")
        assert controller.is_aborted("msg-test") is True
        assert controller.size() == 1
