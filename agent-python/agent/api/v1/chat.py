"""聊天路由

对齐对接文档：
- POST /chat/stream - SSE 流式对话接口
- POST /chat/stream/abort - 中断流式生成（按 messageId）
"""
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from ...application.agent.graph import JobAgentGraph
from ...core.abort import AbortController
from ...core.exceptions import LLMServiceError
from ...core.sse import create_chunk_event, create_done_event, create_error_event, create_ping_event
from ...schemas.chat import AbortRequest, ChatRequest, ChatResponse, ChatStreamRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["聊天"])


def get_agent_graph() -> JobAgentGraph:
    """依赖注入：获取 Agent 图实例"""
    from main import app_state
    return app_state.agent_graph


def get_abort_controller() -> AbortController:
    """依赖注入：获取 Abort 控制器"""
    from main import app_state
    return app_state.abort_controller


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

    对齐对接文档：消费 Agent 的流式执行结果，
    将每个 token chunk 格式化为标准化 SSE 协议数据。

    支持：
    - chunk 事件：content + reasoning（可选）
    - done 事件：info + conversation_id
    - error 事件：message
    - ping 事件：心跳（定时发送）
    """
    import asyncio

    index = 0
    full_content = ""
    last_ping_time = 0

    try:
        async for event in graph.execute_stream(
            user_message=request.message,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            message_id=request.session_id,  # 使用 session_id 作为 message_id（用于 abort）
        ):
            # 检查是否需要发送 ping 心跳（每 15 秒）
            current_time = asyncio.get_event_loop().time()
            if current_time - last_ping_time > 15:
                yield create_ping_event()
                last_ping_time = current_time

            # event 是 dict：{"content": str, "reasoning": str|None}
            content = event.get("content", "")
            reasoning = event.get("reasoning")

            # 格式化为 SSE 事件
            yield create_chunk_event(
                content=content,
                conversation_id=request.conversation_id,
                index=index,
                reasoning=reasoning,
            )
            full_content += content
            index += 1

        # 发送完成事件
        yield create_done_event(
            conversation_id=request.conversation_id,
            info="对话完成",
        )

    except GeneratorExit:
        # 被中断
        logger.warning(f"流式生成被中断 | conversation_id={request.conversation_id}")
        yield create_error_event(message="生成已中断", index=index)

    except Exception as e:
        logger.error(f"流式接口处理失败: {e}", exc_info=True)
        yield create_error_event(message="流式回复生成失败", index=index)


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


@router.post("/stream/abort", summary="中断流式生成（按 messageId）")
async def chat_stream_abort(
    request: AbortRequest,
    abort_controller: AbortController = Depends(get_abort_controller),
):
    """
    中断指定 messageId 的流式生成

    对齐对接文档：
    POST /api/v1/chat/stream/abort
    Body: { "message_id": "uuid" }

    前端调用此接口后，正在进行的流式生成会在下一个 chunk 检查时停止。
    """
    # 使用 message_id 作为 abort key（兼容 conversation_id）
    abort_key = request.message_id
    abort_controller.abort(abort_key)
    logger.info(f"收到中断请求 | message_id={abort_key}")
    return JSONResponse(content={"message": "已发送中断信号"})
