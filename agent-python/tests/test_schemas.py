"""请求 Schema 测试"""
import pytest
from pydantic import ValidationError
from agent.schemas.chat import ChatRequest, ChatStreamRequest, AbortRequest


class TestChatRequest:
    """测试 ChatRequest"""

    def test_valid_request(self):
        """测试有效请求"""
        req = ChatRequest(
            message="你好",
            user_id=1,
            conversation_id=0,
        )
        assert req.message == "你好"
        assert req.user_id == 1
        assert req.stream is False

    def test_message_required(self):
        """测试 message 必填"""
        with pytest.raises(ValidationError):
            ChatRequest(user_id=1)

    def test_message_max_length(self):
        """测试 message 最大长度"""
        with pytest.raises(ValidationError):
            ChatRequest(message="x" * 5001, user_id=1)

    def test_user_id_must_be_positive(self):
        """测试 user_id 必须大于 0"""
        with pytest.raises(ValidationError):
            ChatRequest(message="你好", user_id=0)


class TestChatStreamRequest:
    """测试 ChatStreamRequest"""

    def test_valid_stream_request(self):
        """测试有效流式请求"""
        req = ChatStreamRequest(
            message="你好",
            user_id=1,
            conversation_id=123,
            session_id="session-abc",
            stream=True,
        )
        assert req.message == "你好"
        assert req.user_id == 1
        assert req.conversation_id == 123
        assert req.session_id == "session-abc"
        assert req.stream is True

    def test_default_stream_true(self):
        """测试 stream 默认为 true"""
        req = ChatStreamRequest(
            message="你好",
            user_id=1,
        )
        assert req.stream is True

    def test_session_id_optional(self):
        """测试 session_id 可选"""
        req = ChatStreamRequest(
            message="你好",
            user_id=1,
        )
        assert req.session_id is None


class TestAbortRequest:
    """测试 AbortRequest"""

    def test_valid_abort_request(self):
        """测试有效中断请求"""
        req = AbortRequest(
            message_id="550e8400-e29b-41d4-a716-446655440000"
        )
        assert req.message_id == "550e8400-e29b-41d4-a716-446655440000"

    def test_message_id_required(self):
        """测试 message_id 必填"""
        with pytest.raises(ValidationError):
            AbortRequest()
