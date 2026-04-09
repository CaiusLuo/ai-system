"""DeepSeek LLM 服务实现"""
import logging
from typing import List, AsyncGenerator
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from ...domain.entities import Message
from ...domain.protocols import LLMGateway

logger = logging.getLogger(__name__)


class DeepSeekService(LLMGateway):
    """DeepSeek LLM 服务 - 实现 LLMGateway 协议"""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        temperature: float = 0.7,
    ):
        self._llm = ChatOpenAI(
            model=model,
            openai_api_key=api_key,
            openai_api_base=base_url,
            temperature=temperature,
            streaming=True,  # 启用流式模式
        )
        logger.info(f"DeepSeek 服务已初始化 | model={model} | base_url={base_url}")

    async def generate(
        self,
        messages: List[Message],
        temperature: float = 0.7,
    ) -> str:
        """调用 LLM 生成回复（非流式）"""
        langchain_messages = self._to_langchain_messages(messages)

        try:
            response = await self._llm.ainvoke(langchain_messages)
            return response.content
        except Exception as e:
            logger.error(f"LLM 调用失败: {e}", exc_info=True)
            raise

    async def stream_generate(
        self,
        messages: List[Message],
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """
        流式调用 LLM 生成回复

        Yields:
            每个 token chunk 的文本内容
        """
        langchain_messages = self._to_langchain_messages(messages)

        try:
            async for chunk in self._llm.astream(langchain_messages):
                # chunk.content 是 LangChain AIMessageChunk 的文本
                if hasattr(chunk, "content") and chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"LLM 流式调用失败: {e}", exc_info=True)
            raise

    @staticmethod
    def _to_langchain_messages(messages: List[Message]) -> List[BaseMessage]:
        """转换为 LangChain 消息格式"""
        result = []
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")

            if role == "user":
                result.append(HumanMessage(content=content))
            elif role == "assistant":
                result.append(AIMessage(content=content))
            elif role == "system":
                result.append(SystemMessage(content=content))

        return result
