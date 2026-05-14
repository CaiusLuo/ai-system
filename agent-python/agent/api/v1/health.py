"""健康检查路由"""
from datetime import UTC, datetime

from fastapi import APIRouter, Request

from agent.schemas.common import ApiResponse, success_response
from agent.schemas.pdf import HealthData

router = APIRouter(tags=["健康检查"])


@router.get("/health", summary="健康检查")
async def health():
    """服务健康检查接口"""
    data = HealthData(
        status="ok",
        timestamp=datetime.now(UTC).isoformat(),
    )
    return success_response(data)


@router.get("/ready", summary="就绪检查")
async def readiness(request: Request):
    """
    服务就绪检查
    （可扩展：检查 LLM 服务、外部服务连接状态）
    """
    if getattr(request.app.state, "agent_graph", None) is None:
        return ApiResponse(
            success=True,
            data={
                "status": "degraded",
                "reason": "llm_not_configured",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            message="ok",
            code=0,
        )

    return ApiResponse(
        success=True,
        data={
            "status": "ready",
            "timestamp": datetime.now(UTC).isoformat(),
        },
        message="ok",
        code=0,
    )
