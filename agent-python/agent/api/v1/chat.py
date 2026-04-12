"""聊天路由

对齐对接文档：
- POST /chat/stream - SSE 流式对话接口
- POST /chat/stream/abort - 中断流式生成（按 messageId）
"""
import logging
from collections.abc import AsyncGenerator
from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from ...application.agent.graph import JobAgentGraph
from ...core.abort import AbortController
from ...core.exceptions import LLMServiceError
from ...core.sse import (
    create_chunk_event,
    create_done_event,
    create_error_event,
    create_ping_event,
    create_start_event,
)
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
        event: start
        id: start
        data: {"type":"start","requestId":"...","userId":1,"conversationId":123,"messageId":"msg-...","timestamp":...}

        event: chunk
        id: chunk-0
        data: {"type":"chunk","requestId":"...","userId":1,"conversationId":123,"messageId":"msg-...","content":"你","index":0}

        event: done
        id: done
        data: {"type":"done","requestId":"...","userId":1,"conversationId":123,"messageId":"msg-...","contentLength":150,"chunkCount":42,"timestamp":...}

        event: error
        id: error
        data: {"type":"error","requestId":"...","userId":1,"conversationId":123,"messageId":"msg-...","message":"...","errorCode":"...","timestamp":...}
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

    核心保证：
    1. 所有 chunk 绑定相同的 messageId / conversationId / userId / requestId
    2. 流式开始先发送 start 事件，Java 可提前建立消息映射
    3. 正常结束发送 done 事件，携带 contentLength / chunkCount 供校验
    4. 异常/中断发送 error 事件，同样绑定完整上下文
    5. finally 中清理 abort flag，防止内存泄漏和误中断
    """
    import asyncio

    # 生成或使用传入的 messageId / requestId
    message_id = request.message_id or f"msg-{uuid4().hex[:12]}"
    request_id = request.request_id or f"req-{uuid4().hex[:8]}"

    index = 0
    full_content = ""
    last_ping_time = 0

    logger.info(
        f"开始流式生成 | requestId={request_id} | messageId={message_id} | "
        f"userId={request.user_id} | conversationId={request.conversation_id}"
    )

    try:
        # 1. 先发送 start 事件，让 Java 建立消息映射
        yield create_start_event(
            request_id=request_id,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            message_id=message_id,
        )

        # 2. 流式调用 Agent
        async for event in graph.execute_stream(
            user_message=request.message,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            message_id=message_id,
            request_id=request_id,
        ):
            # 检查是否需要发送 ping 心跳（每 15 秒）
            current_time = asyncio.get_event_loop().time()
            if current_time - last_ping_time > 15:
                yield create_ping_event()
                last_ping_time = current_time

            content = event.get("content", "")
            reasoning = event.get("reasoning")

            yield create_chunk_event(
                content=content,
                index=index,
                request_id=request_id,
                user_id=request.user_id,
                conversation_id=request.conversation_id,
                message_id=message_id,
                reasoning=reasoning,
            )
            full_content += content
            index += 1

        # 3. 发送完成事件
        yield create_done_event(
            request_id=request_id,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            message_id=message_id,
            info="对话完成",
            content_length=len(full_content),
            chunk_count=index,
        )

        logger.info(
            f"流式生成完成 | requestId={request_id} | messageId={message_id} | "
            f"chunks={index} | content_length={len(full_content)}"
        )

    except GeneratorExit:
        # 被客户端断开连接中断
        logger.warning(
            f"流式生成被中断（客户端断开） | requestId={request_id} | messageId={message_id}"
        )
        yield create_error_event(
            message="生成已中断",
            request_id=request_id,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            message_id=message_id,
            index=index,
            error_code="ABORTED",
        )

    except Exception as e:
        logger.error(
            f"流式生成异常 | requestId={request_id} | messageId={message_id} | error={e}",
            exc_info=True,
        )
        yield create_error_event(
            message="流式回复生成失败",
            request_id=request_id,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            message_id=message_id,
            index=index,
            error_code="STREAM_ERROR",
        )

    finally:
        # 4. 确保清理 abort flag，防止内存泄漏和后续请求误中断
        if graph._abort_controller:
            graph._abort_controller.clear(message_id)


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
    abort_key = request.message_id
    abort_controller.abort(abort_key)
    logger.info(f"收到中断请求 | messageId={abort_key}")
    return JSONResponse(content={"message": "已发送中断信号"})
