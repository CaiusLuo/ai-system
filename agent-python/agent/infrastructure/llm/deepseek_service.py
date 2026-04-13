
"""DeepSeek LLM 服务实现

支持 DeepSeek reasoning/thinking 模式：
- content: 正常回复内容
- reasoning_content: 推理过程（think 模式/Chain of Thought）

对齐对接文档：chunk 事件可包含 reasoning 字段。
"""
import logging
from collections.abc import AsyncGenerator

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_openai import ChatOpenAI

from ...domain.entities import Message
from ...domain.protocols import LLMGateway, StreamEvent

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
        messages: list[Message],
        temperature: float = 0.7,
    ) -> str:
        """调用 LLM 生成回复（非流式）"""
        langchain_messages = self._to_langchain_messages(messages)

        try:
            response = await self._llm.ainvoke(langchain_messages)
            # response.content 可能是 str 或 list，统一转为 str
            if isinstance(response.content, str):
                return response.content
            elif isinstance(response.content, list):
                return "".join(item for item in response.content if isinstance(item, str))
            return ""
        except Exception as e:
            logger.error(f"LLM 调用失败: {e}", exc_info=True)
            raise

    async def stream_generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
    ) -> AsyncGenerator[StreamEvent, None]:
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
                reasoning: str | None = None

                # 提取正常回复内容
                # 注意：LangChain 新版中 chunk.content 可能是 list[dict]（多模态/工具调用），
                # 需要统一转为字符串，确保下游拿到的 content 永远是 str 类型
                if hasattr(chunk, "content") and chunk.content:
                    if isinstance(chunk.content, str):
                        content = chunk.content
                    elif isinstance(chunk.content, list):
                        # 多内容块：拼接所有文本片段
                        content = "".join(
                            item for item in chunk.content if isinstance(item, str)
                        )
                    else:
                        # 未知类型，降级为空字符串
                        logger.warning(
                            f"chunk.content 类型异常: {type(chunk.content)}, 降级为空字符串"
                        )
                        content = ""

                # 提取 reasoning_content（DeepSeek think 模式）
                # LangChain 的 AIMessageChunk 可能通过 additional_kwargs 或 response_metadata 传递
                reasoning_content = self._extract_reasoning(chunk)
                if reasoning_content:
                    reasoning = reasoning_content

                # 只要 content 或 reasoning 任一有值就 yield
                # 注意：content 始终保证是 str 类型，即使为空
                if content or reasoning:
                    yield {
                        "content": content,
                        "reasoning": reasoning,
                    }

        except Exception as e:
            logger.error(f"LLM 流式调用失败: {e}", exc_info=True)
            raise

    @staticmethod
    def _extract_reasoning(chunk: AIMessageChunk) -> str | None:
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
    def _to_langchain_messages(messages: list[Message]) -> list[BaseMessage]:
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
