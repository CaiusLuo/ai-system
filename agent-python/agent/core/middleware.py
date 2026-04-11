from typing import List

"""FastAPI 中间件

企业级中间件：
- 请求日志追踪（Request ID）
- 请求耗时统计
- CORS 支持
- 错误追踪
"""
import logging
import time
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件 - 记录每个请求的耗时和状态"""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid4())[:8]
        state = request.scope.get("state", {})
        state["request_id"] = request_id

        # 记录请求信息
        logger.info(
            f"→ {request.method} {request.url.path} | "
            f"client={request.client.host if request.client else 'unknown'}"
        )

        start_time = time.perf_counter()

        try:
            response = await call_next(request)

            duration = time.perf_counter() - start_time

            # 记录响应信息
            logger.info(
                f"← {request.method} {request.url.path} | "
                f"status={response.status_code} | "
                f"duration={duration:.3f}s",
                extra={"request_id": request_id},
            )

            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            return response

        except Exception as e:
            duration = time.perf_counter() - start_time
            logger.error(
                f"✗ {request.method} {request.url.path} | "
                f"error={str(e)} | "
                f"duration={duration:.3f}s",
                exc_info=True,
                extra={"request_id": request_id},
            )
            raise


def setup_cors(app, allow_origins: List[str] = None):
    """
    设置 CORS 中间件

    Args:
        app: FastAPI 应用实例
        allow_origins: 允许的源列表（默认允许所有）
    """
    if allow_origins is None:
        # 开发环境允许所有，生产环境应限制具体域名
        allow_origins = ["*"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
