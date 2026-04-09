"""API 路由聚合"""
from fastapi import APIRouter
from .chat import router as chat_router
from .health import router as health_router

# v1 路由 (prefix: /api/v1)
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(chat_router)
api_router.include_router(health_router)

# 兼容路由 (prefix: /api) - 用于向后兼容
# 注意：chat_router 已有 prefix="/chat"，不需要再额外添加
api_router_compat = APIRouter(prefix="/api")
api_router_compat.include_router(chat_router, tags=["聊天(兼容)"])
