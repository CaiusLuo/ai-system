"""FastAPI 中间件"""
import time
import logging
from uuid import uuid4
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件 - 记录每个请求的耗时和状态"""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid4())[:8]
        state = request.scope.get("state", {})
        state["request_id"] = request_id

        start_time = time.perf_counter()

        response = await call_next(request)

        duration = time.perf_counter() - start_time
        logger.info(
            f"{request.method} {request.url.path} | "
            f"status={response.status_code} | "
            f"duration={duration:.3f}s",
            extra={"request_id": request_id},
        )

        response.headers["X-Request-ID"] = request_id
        return response
