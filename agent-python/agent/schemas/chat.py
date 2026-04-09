"""聊天接口数据模型"""
from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    """聊天请求体"""

    message: str = Field(..., min_length=1, max_length=5000, description="用户消息内容")
    conversation_id: Optional[int] = Field(0, ge=0, description="会话 ID（可选，默认0表示新会话）")
    token: Optional[str] = Field("", description="JWT Token（可选，不传时跳过历史消息获取）")
    session_id: Optional[str] = Field(None, description="会话标识（可选）")
    stream: bool = Field(False, description="是否启用流式输出")


class ChatResponse(BaseModel):
    """聊天响应体（非流式）"""

    reply: str = Field(..., description="AI 回复内容")
    conversation_id: int = Field(..., description="会话 ID（原样返回）")


class ChatStreamRequest(BaseModel):
    """流式聊天请求体"""

    message: str = Field(..., min_length=1, max_length=5000, description="用户消息内容")
    user_id: int = Field(..., gt=0, description="用户 ID")
    conversation_id: Optional[int] = Field(0, ge=0, description="会话 ID（可选，默认0表示新会话）")
    token: Optional[str] = Field("", description="JWT Token（可选，不传时跳过历史消息获取）")
