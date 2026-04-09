"""聊天路由"""
import logging
from typing import AsyncGenerator
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from ...schemas.chat import ChatRequest, ChatResponse, ChatStreamRequest
from ...application.agent.graph import JobAgentGraph
from ...core.exceptions import LLMServiceError
from ...core.sse import create_chunk_event, create_done_event, create_error_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["聊天"])


def get_agent_graph() -> JobAgentGraph:
    """依赖注入：获取 Agent 图实例"""
    from main import app_state
    return app_state.agent_graph


@router.post("", response_model=ChatResponse, summary="聊天接口（非流式）")
async def chat(
    request: ChatRequest,
    graph: JobAgentGraph = Depends(get_agent_graph),
):
    """
    接收用户消息，调用 LangGraph Agent 生成回复

    - **message**: 用户消息内容
    - **user_id**: 用户 ID
    - **conversation_id**: 会话 ID
    """
    try:
        reply = await graph.execute(
            user_message=request.message,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
        )

        return ChatResponse(
            reply=reply,
            conversation_id=request.conversation_id,
        )

    except Exception as e:
        logger.error(f"聊天接口处理失败: {e}", exc_info=True)
        raise LLMServiceError(message="AI 回复生成失败", detail=str(e))


@router.post("/stream", summary="聊天接口（SSE 流式）")
async def chat_stream(
    request: ChatStreamRequest,
    graph: JobAgentGraph = Depends(get_agent_graph),
):
    """
    流式聊天接口 - 使用 SSE 协议逐步返回数据块

    前端使用 fetch + ReadableStream 接收数据，
    每生成一个 token chunk 就立即推送给客户端

    SSE 数据格式：
        event: message
        id: 0
        data: {"type":"chunk","content":"你","index":0,"timestamp":...}

        event: done
        id: final
        data: {"type":"done","content":"","conversation_id":1,...}
    """
    return StreamingResponse(
        _stream_generator(request, graph),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        },
    )


async def _stream_generator(
    request: ChatStreamRequest,
    graph: JobAgentGraph,
) -> AsyncGenerator[str, None]:
    """
    SSE 流式生成器

    消费 Agent 的流式执行结果，
    将每个 token chunk 格式化为 SSE 协议数据
    """
    index = 0
    full_content = ""
    try:
        async for chunk_content in graph.execute_stream(
            user_message=request.message,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
        ):
            # 格式化为 SSE 事件
            yield create_chunk_event(
                content=chunk_content,
                conversation_id=request.conversation_id,
                index=index,
            )
            full_content += chunk_content
            index += 1

        # 根据内容生成 title 总结
        title = _generate_title(full_content)

        # 发送完成事件
        yield create_done_event(
            conversation_id=request.conversation_id,
            total_tokens=index,
            title=title,
        )

    except Exception as e:
        logger.error(f"流式接口处理失败: {e}", exc_info=True)
        # 发送错误事件
        yield create_error_event(
            message="流式回复生成失败",
        )


def _generate_title(content: str) -> str:
    """
    根据回复内容生成简短 title（不超过 50 字）

    规则：
    - 如果内容为空，返回 "对话完成"
    - 否则取前 50 个字符，加上 "..." 如果超过
    """
    if not content:
        return "对话完成"

    # 去除首尾空白
    content = content.strip()

    # 如果超过 50 字，截断
    if len(content) > 50:
        # 尝试在标点符号处截断
        for punct in "。，！？、；：\n":
            idx = content.find(punct, 40, 50)
            if idx != -1:
                return content[:idx + 1]
        return content[:50] + "..."

    return content
