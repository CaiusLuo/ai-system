"""
Job Agent API - FastAPI 应用入口

企业级分层架构：
- api/:          接口层（HTTP 路由）
- application/:  应用层（业务逻辑/Agent 编排）
- domain/:       领域层（实体/协议定义）
- infrastructure/ 基础设施层（外部服务客户端）
- core/:         核心层（配置/异常/中间件/日志）
- schemas/:      数据模型层
- prompts/:      Prompt 配置层
"""
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

from agent.core.config import settings
from agent.core.logging import setup_logging
from agent.core.middleware import RequestLoggingMiddleware
from agent.core.exceptions import AgentException

from agent.infrastructure.llm.deepseek_service import DeepSeekService
from agent.infrastructure.external.java_backend_client import JavaBackendClient
from agent.application.agent.graph import JobAgentGraph

from agent.api.v1.router import api_router, api_router_compat


class AppState:
    """应用状态容器 - 替代全局变量"""

    def __init__(self):
        self.agent_graph: Optional[JobAgentGraph] = None


app_state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    setup_logging()

    # 初始化基础设施
    java_client = JavaBackendClient(
        base_url=settings.java_backend_url or "",
        timeout=settings.java_backend_timeout,
    )

    llm_service = DeepSeekService(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        model=settings.deepseek_model,
        temperature=settings.llm_temperature,
    )

    # 注入依赖，构建 Agent 图
    app_state.agent_graph = JobAgentGraph(
        repository=java_client,
        llm_gateway=llm_service,
    )

    yield


def create_app() -> FastAPI:
    """应用工厂 - 创建并配置 FastAPI 实例"""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 注册中间件
    app.add_middleware(RequestLoggingMiddleware)

    # 注册全局异常处理器
    @app.exception_handler(AgentException)
    async def agent_exception_handler(
        request: Request, exc: AgentException
    ):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message, "detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(
        request: Request, exc: Exception
    ):
        return JSONResponse(
            status_code=500,
            content={"error": "服务器内部错误", "detail": str(exc)},
        )

    # 注册路由
    app.include_router(api_router)
    app.include_router(api_router_compat)

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5001,
        reload=settings.debug,
    )

