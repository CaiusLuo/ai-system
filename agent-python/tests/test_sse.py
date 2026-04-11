"""SSE 格式化工具测试"""
import pytest
import json
from agent.core.sse import (
    format_sse,
    create_chunk_event,
    create_done_event,
    create_error_event,
    create_ping_event,
)


class TestFormatSSE:
    """测试 format_sse 函数"""

    def test_basic_format(self):
        """测试基本格式"""
        data = {"type": "chunk", "content": "你好"}
        result = format_sse(data=data, event="chunk")

        lines = result.split("\n")
        assert "event: chunk" in lines
        assert 'data: {"type": "chunk", "content": "你好"}' in lines
        assert lines[-1] == ""  # 双换行结尾

    def test_with_event_id(self):
        """测试带事件 ID"""
        data = {"type": "chunk"}
        result = format_sse(data=data, event="chunk", event_id="chunk-0")

        lines = result.split("\n")
        assert "id: chunk-0" in lines
        assert "event: chunk" in lines

    def test_json_serialization(self):
        """测试 JSON 序列化"""
        data = {"type": "done", "info": "完成", "count": 10}
        result = format_sse(data=data, event="done")

        # 提取 data 行并解析 JSON
        for line in result.split("\n"):
            if line.startswith("data: "):
                parsed = json.loads(line[6:])
                assert parsed == data
                break


class TestCreateChunkEvent:
    """测试 create_chunk_event 函数"""

    def test_basic_chunk(self):
        """测试基本 chunk 事件"""
        result = create_chunk_event(content="你好", index=0)

        assert "event: chunk" in result
        assert "id: chunk-0" in result

        # 解析 data
        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["type"] == "chunk"
                assert data["content"] == "你好"
                assert data["index"] == 0
                break

    def test_with_reasoning(self):
        """测试包含 reasoning"""
        result = create_chunk_event(
            content="回复",
            index=1,
            reasoning="推理过程",
        )

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["reasoning"] == "推理过程"
                break

    def test_with_conversation_id(self):
        """测试包含 conversation_id"""
        result = create_chunk_event(
            content="回复",
            index=2,
            conversation_id=123,
        )

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["conversation_id"] == 123
                break

    def test_no_reasoning_when_none(self):
        """测试 reasoning 为 None 时不包含该字段"""
        result = create_chunk_event(content="回复", index=0, reasoning=None)

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert "reasoning" not in data
                break


class TestCreateDoneEvent:
    """测试 create_done_event 函数"""

    def test_basic_done(self):
        """测试基本 done 事件"""
        result = create_done_event(info="对话完成")

        assert "event: done" in result

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["type"] == "done"
                assert data["info"] == "对话完成"
                break

    def test_with_conversation_id(self):
        """测试包含 conversation_id"""
        result = create_done_event(conversation_id=456, info="完成")

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["conversation_id"] == 456
                break


class TestCreateErrorEvent:
    """测试 create_error_event 函数"""

    def test_error_event(self):
        """测试错误事件"""
        result = create_error_event(message="出错了")

        assert "event: error" in result

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["type"] == "error"
                assert data["message"] == "出错了"
                break

    def test_with_index(self):
        """测试包含 index"""
        result = create_error_event(message="错误", index=5)

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["index"] == 5
                break


class TestCreatePingEvent:
    """测试 create_ping_event 函数"""

    def test_ping_event(self):
        """测试心跳事件"""
        result = create_ping_event()

        assert "event: ping" in result

        for line in result.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["type"] == "ping"
                break
