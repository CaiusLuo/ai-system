"""健康检查路由"""
from fastapi import APIRouter

router = APIRouter(tags=["健康检查"])


@router.get("/health", summary="健康检查")
async def health():
    """服务健康检查接口"""
    return {"status": "ok"}


@router.get("/ready", summary="就绪检查")
async def readiness():
    """
    服务就绪检查
    （可扩展：检查 LLM 服务、外部服务连接状态）
    """
    return {"status": "ready"}
