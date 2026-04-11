
"""领域实体"""
from typing import List, TypedDict


class Message(TypedDict):
    """消息实体"""

    role: str  # "user" | "assistant" | "system"
    content: str


class AgentState(TypedDict):
    """Agent 执行状态"""

    # 输入
    user_message: str
    user_id: int
    conversation_id: int

    # 中间数据
    history_messages: List[Message]
    system_prompt: str

    # 输出
    reply: str
