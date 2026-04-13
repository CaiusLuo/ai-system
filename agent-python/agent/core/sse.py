"""SSE (Server-Sent Events) 格式化工具

标准化协议：所有事件统一绑定 requestId / userId / conversationId / messageId，
确保 Java 后端能正确归并 chunk 到对应的 assistant message。

事件类型：
- start: 流式开始，Java 收到后立即建立消息映射
- chunk: AI 内容片段（含 reasoning 可选）
- done: 对话完成
- error: 错误信息
- ping: 心跳（定时发送）
"""
import json
import time
from typing import Any


def format_sse(
    data: dict[str, Any],
    event: str = "message",
    event_id: str | None = None,
) -> str:
    """
    将数据格式化为 SSE 协议格式

    Args:
        data: 要发送的数据字典
        event: 事件类型（start/chunk/done/error/ping）
        event_id: 事件 ID（可选，格式如 "chunk-0", "done-2"）

    Returns:
        SSE 格式的字符串
    """
    lines = []

    if event_id is not None:
        lines.append(f"id: {event_id}")

    lines.append(f"event: {event}")
    lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
    lines.append("")  # 空行
    lines.append("")  # 双换行表示消息结束

    return "\n".join(lines)


def _build_base_data(
    event_type: str,
    request_id: str | None = None,
    user_id: int | None = None,
    conversation_id: int | None = None,
    message_id: str | None = None,
) -> dict[str, Any]:
    """
    构建事件的基础数据，统一绑定上下文追踪字段

    所有 SSE 事件（ping 除外）都应调用此方法，
    确保 Java 后端能将 chunk 正确归并到 assistant message。
    """
    data: dict[str, Any] = {"type": event_type}
    if request_id is not None:
        data["requestId"] = request_id
    if user_id is not None:
        data["userId"] = user_id
    if conversation_id is not None:
        data["conversationId"] = conversation_id
    if message_id is not None:
        data["messageId"] = message_id
    return data


def create_start_event(
    request_id: str | None = None,
    user_id: int | None = None,
    conversation_id: int | None = None,
    message_id: str | None = None,
) -> str:
    """
    创建 start 事件（流式开始）

    Java 收到后应立即建立消息映射，准备接收后续 chunk。
    """
    data = _build_base_data("start", request_id, user_id, conversation_id, message_id)
    data["timestamp"] = int(time.time() * 1000)
    return format_sse(data=data, event="start", event_id="start")


def create_chunk_event(
    content: str,
    index: int,
    request_id: str | None = None,
    user_id: int | None = None,
    conversation_id: int | None = None,
    message_id: str | None = None,
    reasoning: str | None = None,
) -> str:
    """
    创建 chunk 事件（AI 内容片段）

    每个 chunk 都绑定完整的上下文，Java 可按 messageId 归并。
    content 始终保证为 str 类型，即使为空字符串也不省略。
    """
    data = _build_base_data("chunk", request_id, user_id, conversation_id, message_id)
    # 防御性处理：确保 content 是 str 类型
    data["content"] = str(content) if content is not None else ""
    data["index"] = index
    if reasoning:
        data["reasoning"] = reasoning
    return format_sse(data=data, event="chunk", event_id=f"chunk-{index}")


def create_done_event(
    request_id: str | None = None,
    user_id: int | None = None,
    conversation_id: int | None = None,
    message_id: str | None = None,
    info: str = "对话完成",
    content_length: int = 0,
    chunk_count: int = 0,
) -> str:
    """
    创建 done 事件（对话完成）

    携带 content_length / chunk_count 供 Java 校验完整性。
    """
    data = _build_base_data("done", request_id, user_id, conversation_id, message_id)
    data["info"] = info
    data["contentLength"] = content_length
    data["chunkCount"] = chunk_count
    data["timestamp"] = int(time.time() * 1000)
    return format_sse(data=data, event="done", event_id="done")


def create_error_event(
    message: str,
    request_id: str | None = None,
    user_id: int | None = None,
    conversation_id: int | None = None,
    message_id: str | None = None,
    index: int | None = None,
    error_code: str | None = None,
) -> str:
    """
    创建 error 事件（错误）

    异常分支也必须绑定完整的上下文，确保 Java 能识别并结束消息。
    """
    data = _build_base_data("error", request_id, user_id, conversation_id, message_id)
    data["message"] = message
    if index is not None:
        data["index"] = index
    if error_code:
        data["errorCode"] = error_code
    data["timestamp"] = int(time.time() * 1000)
    return format_sse(data=data, event="error", event_id="error")


def create_ping_event() -> str:
    """
    创建 ping 事件（心跳）

    用于保持连接活跃，前端可忽略或用于检测连接状态。
    ping 事件不包含上下文（仅用于连接保活）。
    """
    data = {"type": "ping"}
    return format_sse(data=data, event="ping")
