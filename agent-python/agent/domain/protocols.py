"""领域协议 - 定义服务契约，实现依赖倒置"""
from typing import List, Protocol, AsyncGenerator
from .entities import Message


class ConversationRepository(Protocol):
    """会话历史仓储协议"""

    async def get_history(
        self,
        conversation_id: int,
        token: str,
    ) -> List[Message]: ...


class LLMGateway(Protocol):
    """LLM 网关协议"""

    async def generate(
        self,
        messages: List[Message],
        temperature: float = 0.7,
    ) -> str: ...

    async def stream_generate(
        self,
        messages: List[Message],
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]: ...
