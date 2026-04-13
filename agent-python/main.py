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

对齐对接文档：
- SSE 流式对话：POST /api/v1/chat/stream
- 中断流式生成：POST /api/v1/chat/stream/abort
- 健康检查：GET /api/v1/health
"""
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

from agent.core.config import settings
from agent.core.logging import setup_logging
from agent.core.middleware import RequestLoggingMiddleware, setup_cors
from agent.core.exceptions import AgentException, LLMServiceError, ExternalServiceError
from agent.core.abort import AbortController

from agent.infrastructure.llm.deepseek_service import DeepSeekService
from agent.infrastructure.external.java_backend_client import JavaBackendClient
from agent.application.agent.graph import JobAgentGraph

from agent.api.v1.router import api_router, api_router_compat


class AppState:
    """应用状态容器 - 替代全局变量"""

    def __init__(self):
        self.agent_graph: JobAgentGraph | None = None
        self.abort_controller: AbortController | None = None


app_state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    setup_logging()

    # 初始化 Abort 控制器
    app_state.abort_controller = AbortController()
    app.state.abort_controller = app_state.abort_controller

    # 初始化基础设施
    java_client = JavaBackendClient(
        base_url=settings.java_backend_url or "",
        timeout=settings.java_backend_timeout,
    )

    if settings.has_llm_config():
        llm_service = DeepSeekService(
            api_key=settings.deepseek_api_key or "",
            base_url=settings.deepseek_base_url or "",
            model=settings.deepseek_model,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
            timeout=settings.llm_timeout,
        )

        # 注入依赖，构建 Agent 图
        app_state.agent_graph = JobAgentGraph(
            repository=java_client,
            llm_gateway=llm_service,
            abort_controller=app_state.abort_controller,
        )
    else:
        app_state.agent_graph = None

    app.state.agent_graph = app_state.agent_graph

    yield

    # 清理资源（预留）
    logger = logging.getLogger(__name__)
    logger.info("应用关闭，资源清理完成")


def create_app() -> FastAPI:
    """应用工厂 - 创建并配置 FastAPI 实例"""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 注册 CORS 中间件
    setup_cors(app, allow_origins=settings.get_cors_origins())

    # 注册请求日志中间件
    app.add_middleware(RequestLoggingMiddleware)

    # 注册全局异常处理器
    @app.exception_handler(AgentException)
    async def agent_exception_handler(
        request: Request, exc: AgentException
    ):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )

    @app.exception_handler(LLMServiceError)
    async def llm_service_error_handler(
        request: Request, exc: LLMServiceError
    ):
        return JSONResponse(
            status_code=502,
            content={
                "error_code": "LLM_SERVICE_ERROR",
                "message": "AI 服务暂时不可用，请稍后重试",
                "detail": str(exc.detail) if exc.detail else None,
            },
        )

    @app.exception_handler(ExternalServiceError)
    async def external_service_error_handler(
        request: Request, exc: ExternalServiceError
    ):
        return JSONResponse(
            status_code=502,
            content={
                "error_code": "EXTERNAL_SERVICE_ERROR",
                "message": "外部服务调用失败",
                "detail": str(exc.detail) if exc.detail else None,
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(
        request: Request, exc: Exception
    ):
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"未处理的异常: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error_code": "INTERNAL_ERROR",
                "message": "服务器内部错误",
                "detail": str(exc) if settings.debug else None,
            },
        )

    # 注册路由
    app.include_router(api_router)
    app.include_router(api_router_compat)

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info",
    )
