from typing import Optional

"""聊天接口数据模型

对齐对接文档标准化请求体格式：
{
    "message": "string",              // 用户消息内容
    "conversation_id": number,        // 会话 ID（可选）
    "session_id": "string",           // 会话标识（可选）
    "message_id": "string",           // 消息唯一标识（由 Java 后端生成）
    "request_id": "string",           // 请求追踪 ID（可选）
    "user_id": number,                // 用户 ID
    "stream": true                    // 固定为 true，启用流式输出
}
"""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """聊天请求体（非流式）"""

    message: str = Field(..., min_length=1, max_length=5000, description="用户消息内容")
    conversation_id: Optional[int] = Field(0, ge=0, description="会话 ID（可选，默认0表示新会话）")
    session_id: Optional[str] = Field(None, description="会话标识（可选）")
    user_id: int = Field(1, gt=0, description="用户 ID")
    stream: bool = Field(False, description="是否启用流式输出")


class ChatResponse(BaseModel):
    """聊天响应体（非流式）"""

    reply: str = Field(..., description="AI 回复内容")
    conversation_id: int = Field(..., description="会话 ID（原样返回）")


class ChatStreamRequest(BaseModel):
    """流式聊天请求体

    对齐对接文档：
    {
        "message": "string",
        "conversation_id": number,     // 可选
        "session_id": "string",        // 可选
        "message_id": "string",        // 消息唯一标识（由 Java 后端生成）
        "request_id": "string",        // 请求追踪 ID（可选）
        "user_id": number,
        "stream": true
    }
    """

    message: str = Field(..., min_length=1, max_length=5000, description="用户消息内容")
    user_id: int = Field(..., gt=0, description="用户 ID")
    conversation_id: Optional[int] = Field(0, ge=0, description="会话 ID（可选，默认0表示新会话）")
    session_id: Optional[str] = Field(None, description="会话标识（可选）")
    message_id: Optional[str] = Field(None, description="消息唯一标识（由 Java 后端生成，用于 chunk 归并和 abort）")
    request_id: Optional[str] = Field(None, description="请求追踪 ID（可选，用于全链路日志追踪）")
    stream: bool = Field(True, description="是否启用流式输出（固定为 true）")


class AbortRequest(BaseModel):
    """中断流式生成请求体

    对齐对接文档：
    {
        "messageId": "string"          // 消息唯一标识
    }
    """

    message_id: str = Field(..., description="消息唯一标识（用于 abort）")
