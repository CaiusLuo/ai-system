
"""DeepSeek LLM 服务实现

支持 DeepSeek reasoning/thinking 模式：
- content: 正常回复内容
- reasoning_content: 推理过程（think 模式/Chain of Thought）

对齐对接文档：chunk 事件可包含 reasoning 字段。
"""
import logging
from collections.abc import AsyncGenerator
from typing import Any, List, Optional

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_openai import ChatOpenAI

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
        max_tokens: int = 4096,
        timeout: float = 60.0,
    ):
        self._llm = ChatOpenAI(
            model=model,
            openai_api_key=api_key,
            openai_api_base=base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            streaming=True,  # 启用流式模式
        )
        self._model = model
        logger.info(
            f"DeepSeek 服务已初始化 | "
            f"model={model} | base_url={base_url} | temperature={temperature}"
        )

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
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        流式调用 LLM 生成回复

        支持 DeepSeek reasoning/thinking 模式：
        - content: 正常回复内容
        - reasoning_content: 推理过程（think 模式）

        Yields:
            dict: {
                "content": str,           # AI 回复内容片段
                "reasoning": Optional[str]     # 推理过程（可选）
            }
        """
        langchain_messages = self._to_langchain_messages(messages)

        try:
            async for chunk in self._llm.astream(langchain_messages):
                # chunk 是 AIMessageChunk 类型
                content = ""
                reasoning = None

                # 提取正常回复内容
                if hasattr(chunk, "content") and chunk.content:
                    content = chunk.content

                # 提取 reasoning_content（DeepSeek think 模式）
                # LangChain 的 AIMessageChunk 可能通过 additional_kwargs 或 response_metadata 传递
                reasoning_content = self._extract_reasoning(chunk)
                if reasoning_content:
                    reasoning = reasoning_content

                # 只有当有内容或 reasoning 时才 yield
                if content or reasoning:
                    yield {
                        "content": content,
                        "reasoning": reasoning,
                    }

        except Exception as e:
            logger.error(f"LLM 流式调用失败: {e}", exc_info=True)
            raise

    @staticmethod
    def _extract_reasoning(chunk: AIMessageChunk) -> Optional[str]:
        """
        从 LangChain chunk 中提取 reasoning 内容

        DeepSeek 的 thinking 模式可能通过以下方式返回：
        1. response_metadata.reasoning_content
        2. additional_kwargs.reasoning_content
        3. response_metadata.thinking
        4. additional_kwargs.thinking
        """
        # 尝试从 response_metadata 获取
        if hasattr(chunk, "response_metadata") and chunk.response_metadata:
            reasoning = (
                chunk.response_metadata.get("reasoning_content")
                or chunk.response_metadata.get("thinking")
            )
            if reasoning:
                return reasoning

        # 尝试从 additional_kwargs 获取
        if hasattr(chunk, "additional_kwargs") and chunk.additional_kwargs:
            reasoning = (
                chunk.additional_kwargs.get("reasoning_content")
                or chunk.additional_kwargs.get("thinking")
            )
            if reasoning:
                return reasoning

        return None

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
