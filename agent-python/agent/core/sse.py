"""SSE (Server-Sent Events) 格式化工具"""
import json
import time
from typing import Any, Generator, Union, Optional


def format_sse(
    data: dict,
    event: str = "message",
    event_id: Optional[Union[int, str]] = None,
) -> str:
    """
    将数据格式化为 SSE 协议格式

    Args:
        data: 要发送的数据字典
        event: 事件类型（message/done/error）
        event_id: 事件 ID（可选）

    Returns:
        SSE 格式的字符串

    SSE 协议格式：
        event: message
        id: 1
        data: {"type":"chunk","content":"你好"}

        （注意：每个 SSE 消息以双换行 \\n\\n 结束）
    """
    lines = []

    if event_id is not None:
        lines.append(f"id: {event_id}")

    lines.append(f"event: {event}")
    lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
    lines.append("")  # 空行
    lines.append("")  # 双换行表示消息结束

    return "\n".join(lines)


def create_chunk_event(
    content: str,
    conversation_id: Optional[int] = None,
    index: int = 0,
) -> str:
    """创建 chunk 事件"""
    data = {
        "type": "chunk",
        "content": content,
        "index": index,
        "timestamp": int(time.time()),
    }
    if conversation_id is not None:
        data["conversation_id"] = conversation_id
    return format_sse(data=data, event="message", event_id=index)


def create_done_event(
    conversation_id: int,
    total_tokens: int,
    title: str = "对话完成",
) -> str:
    """创建完成事件

    Args:
        conversation_id: 会话 ID
        total_tokens: 总 chunk 数量
        title: Agent 总结信息
    """
    data = {
        "type": "done",
        "content": "",
        "conversation_id": conversation_id,
        "total_tokens": total_tokens,
        "timestamp": int(time.time()),
        "title": title,
    }
    return format_sse(data=data, event="done", event_id="final")


def create_error_event(message: str) -> str:
    """创建错误事件

    Args:
        message: 错误描述信息
    """
    data = {
        "type": "error",
        "message": message,
    }
    return format_sse(data=data, event="error", event_id="error")
