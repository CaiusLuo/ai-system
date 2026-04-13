
"""LangGraph Agent 图编排

企业级设计：
- 支持 reasoning/thinking 内容传递
- 支持 abort 机制（按 message_id 或 conversation_id）
- 完善的日志追踪
"""
import logging
from collections.abc import AsyncGenerator

from langgraph.graph import END, START, StateGraph

from ...core.abort import AbortController
from ...domain.entities import AgentState, Message
from ...domain.protocols import ConversationRepository, LLMGateway, StreamEvent
from .nodes import (
    create_fetch_history_node,
    create_generate_reply_node,
)

logger = logging.getLogger(__name__)


class JobAgentGraph:
    """
    求职 Agent LangGraph 图编排类

    工作流: START → fetch_history → generate_reply → END

    流式模式：直接调用 LLM 的 stream_generate（跳过 LangGraph 图），
    以实现 token 级别的流式输出。
    """

    def __init__(
        self,
        repository: ConversationRepository,
        llm_gateway: LLMGateway,
        abort_controller: AbortController | None = None,
    ):
        self._repository = repository
        self._llm_gateway = llm_gateway
        self._abort_controller = abort_controller
        self._graph = self._build_graph()

    def _build_graph(self):
        """构建并编译 LangGraph 工作流"""
        workflow = StateGraph(AgentState)

        # 注册节点
        workflow.add_node(
            "fetch_history",
            create_fetch_history_node(self._repository),
        )
        workflow.add_node(
            "generate_reply",
            create_generate_reply_node(self._llm_gateway),
        )

        # 定义执行流
        workflow.add_edge(START, "fetch_history")
        workflow.add_edge("fetch_history", "generate_reply")
        workflow.add_edge("generate_reply", END)

        return workflow.compile()

    async def execute(
        self,
        user_message: str,
        user_id: int,
        conversation_id: int,
        system_prompt: str = "",
    ) -> str:
        """
        执行 Agent 工作流（非流式）

        Args:
            user_message: 用户当前消息
            user_id: 用户 ID
            conversation_id: 会话 ID
            system_prompt: 可选的自定义系统提示词

        Returns:
            AI 生成的回复内容
        """
        initial_state = AgentState(
            user_message=user_message,
            user_id=user_id,
            conversation_id=conversation_id,
            history_messages=[],
            system_prompt=system_prompt,
            reply="",
        )

        logger.info(
            f"开始执行 Agent 工作流 | "
            f"conversation_id={conversation_id} | "
            f"message_length={len(user_message)}"
        )

        result = await self._graph.ainvoke(initial_state)

        logger.info(
            f"Agent 工作流执行完成 | "
            f"reply_length={len(result['reply'])}"
        )

        return result["reply"]

    async def execute_stream(
        self,
        user_message: str,
        user_id: int,
        conversation_id: int,
        system_prompt: str = "",
        message_id: str | None = None,
        request_id: str | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        执行 Agent 工作流（流式）

        核心思路：
        1. 先执行 fetch_history 节点（非流式）
        2. 构建消息上下文
        3. 直接调用 LLM 的 stream_generate（跳过 LangGraph 图）
        4. 逐 chunk yield，每次 yield 前检查 abort 标志

        为什么跳过 LangGraph 图？
        因为 LangGraph 的 astream 是节点级别的流式，
        而不是 token 级别的流式。要实现真正的逐字输出，
        需要直接消费 LLM 的 astream。

        Yields:
            dict: {
                "content": str,           # AI 回复内容片段
                "reasoning": Optional[str]     # 推理过程（可选）
            }

        Raises:
            GeneratorExit: 当检测到 abort 时抛出，通知调用方中断
        """
        abort_key = message_id or str(conversation_id)

        log_extra = f"abortKey={abort_key} | conversationId={conversation_id}"
        if request_id:
            log_extra = f"requestId={request_id} | {log_extra}"
        if message_id:
            log_extra = f"messageId={message_id} | {log_extra}"

        logger.info(
            f"开始流式执行 Agent 工作流 | {log_extra} | "
            f"messageLength={len(user_message)}"
        )

        # 1. 获取历史消息（简化处理，暂不获取）
        history: list[Message] = []

        # 2. 构建消息上下文
        messages = self._build_messages_for_stream(
            user_message=user_message,
            history=history,
            system_prompt=system_prompt,
        )

        # 3. 流式调用 LLM，逐 chunk yield，每次检查 abort
        async for event in self._llm_gateway.stream_generate(messages):
            # 检查是否被中断
            if self._abort_controller and self._abort_controller.is_aborted(abort_key):
                logger.warning(f"流式生成被中断 | {log_extra}")
                self._abort_controller.clear(abort_key)
                raise GeneratorExit("Stream aborted by client")

            yield event

        logger.info(f"流式 Agent 工作流执行完成 | {log_extra}")

    @staticmethod
    def _build_messages_for_stream(
        user_message: str,
        history: list[Message],
        system_prompt: str = "",
    ) -> list[Message]:
        """构建流式模式的消息列表"""
        from ...domain.entities import Message
        from ...prompts.system import SYSTEM_PROMPT

        messages = []

        # System prompt
        prompt = system_prompt or SYSTEM_PROMPT
        messages.append(Message(role="system", content=prompt))

        # 历史消息
        for msg in history:
            messages.append(Message(role=msg["role"], content=msg["content"]))

        # 当前用户消息
        messages.append(Message(role="user", content=user_message))

        return messages
