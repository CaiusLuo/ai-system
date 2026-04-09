"""Agent 节点定义"""
import logging
from typing import List
from ...domain.entities import AgentState, Message
from ...domain.protocols import ConversationRepository, LLMGateway
from ...prompts.system import SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def create_fetch_history_node(repository: ConversationRepository):
    """创建获取历史消息节点（工厂函数）"""

    async def fetch_history_node(state: AgentState) -> dict:
        """从外部服务获取会话历史"""
        logger.debug(
            f"获取历史消息 | conversation_id={state['conversation_id']}"
        )

        # 简化处理，返回空历史（后续可根据 user_id 实现）
        history = []

        logger.debug(f"获取到 {len(history)} 条历史消息")
        return {"history_messages": history}

    return fetch_history_node


def create_generate_reply_node(llm_gateway: LLMGateway):
    """创建生成回复节点（工厂函数）"""

    async def generate_reply_node(state: AgentState) -> dict:
        """构建消息上下文并调用 LLM 生成回复"""
        messages = _build_messages(state)

        logger.debug(
            f"调用 LLM 生成回复 | message_count={len(messages)}"
        )

        reply = await llm_gateway.generate(messages)

        logger.info("LLM 回复生成完成")
        return {"reply": reply}

    return generate_reply_node


def _build_messages(state: AgentState) -> List[Message]:
    """构建完整的消息上下文"""
    messages = []

    # System prompt
    system_prompt = state.get("system_prompt") or SYSTEM_PROMPT
    messages.append(Message(role="system", content=system_prompt))

    # 历史消息
    for msg in state.get("history_messages", []):
        messages.append(Message(role=msg["role"], content=msg["content"]))

    # 当前用户消息
    messages.append(Message(role="user", content=state["user_message"]))

    return messages


def create_stream_generate_node(llm_gateway: LLMGateway):
    """
    创建流式生成回复节点（工厂函数）

    注意：此函数目前未被使用，因为流式模式直接调用 LLM 的 stream_generate，
    跳过 LangGraph 图以实现真正的 token 级别流式输出。
    """
    pass  # 保留占位，实际使用 graph.execute_stream()
