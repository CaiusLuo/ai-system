
"""领域协议 - 定义服务契约，实现依赖倒置"""
from collections.abc import AsyncGenerator
from typing import Any, Protocol

from .entities import Message

type StreamEvent = dict[str, Any]


class ConversationRepository(Protocol):
    """会话历史仓储协议"""

    async def get_history(
        self,
        conversation_id: int,
        token: str,
    ) -> list[Message]: ...


class LLMGateway(Protocol):
    """LLM 网关协议"""

    async def generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
    ) -> str: ...

    async def stream_generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
    ) -> AsyncGenerator[StreamEvent, None]: ...
