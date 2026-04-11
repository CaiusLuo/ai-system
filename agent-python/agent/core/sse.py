from typing import Optional

"""SSE (Server-Sent Events) 格式化工具

对齐对接文档标准化格式：
- chunk 事件：type="chunk", content, reasoning(可选), conversation_id(可选)
- done 事件：type="done", info, conversation_id(可选)
- error 事件：type="error", message
- ping 事件：type="ping"

Java 后端会标准化字段后转发给前端。
"""
import json


def format_sse(data: dict, event: str = "message", event_id: Optional[str] = None) -> str:
    """
    将数据格式化为 SSE 协议格式

    Args:
        data: 要发送的数据字典
        event: 事件类型（chunk/done/error/ping）
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


def create_chunk_event(
    content: str,
    index: int,
    reasoning: Optional[str] = None,
    conversation_id: Optional[int] = None,
) -> str:
    """
    创建 chunk 事件（AI 内容片段）

    对齐文档：Java 后端会将字段标准化为：
    {
        "type": "chunk",
        "content": "...",
        "index": 0,
        "reasoning": "...",      // 可选，DeepSeek think 模式
        "conversationId": 123    // 可选
    }
    """
    data = {
        "type": "chunk",
        "content": content,
        "index": index,
    }

    if reasoning:
        data["reasoning"] = reasoning

    if conversation_id is not None:
        data["conversation_id"] = conversation_id

    return format_sse(data=data, event="chunk", event_id=f"chunk-{index}")


def create_done_event(
    conversation_id: Optional[int] = None,
    info: str = "对话完成",
) -> str:
    """
    创建 done 事件（对话完成）

    对齐文档：Java 后端会注入 messageId 后转发给前端：
    {
        "type": "done",
        "info": "对话完成",
        "conversationId": 123,
        "messageId": "uuid"       // Java 后端注入
    }
    """
    data = {
        "type": "done",
        "info": info,
    }

    if conversation_id is not None:
        data["conversation_id"] = conversation_id

    # 使用 info 作为 event 名，Java 后端可识别
    return format_sse(data=data, event="done", event_id="done")


def create_error_event(message: str, index: Optional[int] = None) -> str:
    """
    创建 error 事件（错误）

    对齐文档：
    {
        "type": "error",
        "message": "错误信息",
        "index": 5               // 可选
    }
    """
    data = {
        "type": "error",
        "message": message,
    }

    if index is not None:
        data["index"] = index

    return format_sse(data=data, event="error", event_id="error")


def create_ping_event() -> str:
    """
    创建 ping 事件（心跳）

    用于保持连接活跃，前端可忽略或用于检测连接状态。
    """
    data = {"type": "ping"}
    return format_sse(data=data, event="ping")
