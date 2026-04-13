"""聊天接口数据模型。"""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """非流式聊天请求。"""

    message: str = Field(..., min_length=1, max_length=5000, description="用户消息内容")
    conversation_id: int | None = Field(0, ge=0, description="会话 ID，默认 0 表示新会话")
    session_id: str | None = Field(None, description="会话标识，可选")
    user_id: int = Field(1, gt=0, description="用户 ID")
    stream: bool = Field(False, description="是否启用流式输出")


class ChatResponse(BaseModel):
    """非流式聊天响应。"""

    reply: str = Field(..., description="AI 回复内容")
    conversation_id: int = Field(..., description="会话 ID")


class ChatStreamRequest(BaseModel):
    """流式聊天请求。"""

    message: str = Field(..., min_length=1, max_length=5000, description="用户消息内容")
    user_id: int = Field(..., gt=0, description="用户 ID")
    conversation_id: int | None = Field(0, ge=0, description="会话 ID，默认 0 表示新会话")
    session_id: str | None = Field(None, description="会话标识，可选")
    message_id: str | None = Field(
        None,
        description="消息唯一标识，由 Java 后端生成，用于 chunk 归并和 abort",
    )
    request_id: str | None = Field(None, description="请求追踪 ID，可选")
    stream: bool = Field(True, description="是否启用流式输出，固定为 true")


class AbortRequest(BaseModel):
    """中断流式生成请求。"""

    message_id: str = Field(..., description="用于 abort 的消息唯一标识")
