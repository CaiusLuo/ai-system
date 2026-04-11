"""业务异常定义

企业级异常体系：
- 明确的错误码和 HTTP 状态码映射
- 支持错误详情追踪
- 友好的错误消息国际化（预留）
"""

from typing import Any, Optional


class AgentException(Exception):  # noqa: N818
    """Agent 业务异常基类"""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        detail: Optional[Any] = None,
        error_code: str = "INTERNAL_ERROR",
    ):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        super().__init__(message)

    def to_dict(self) -> dict:
        """转换为字典格式（用于 API 响应）"""
        return {
            "error_code": self.error_code,
            "message": self.message,
            "detail": self.detail,
        }


class LLMServiceError(AgentException):
    """LLM 服务调用异常"""

    def __init__(self, message: str, detail: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=502,
            detail=detail,
            error_code="LLM_SERVICE_ERROR",
        )


class ExternalServiceError(AgentException):
    """外部服务调用异常"""

    def __init__(self, message: str, detail: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=502,
            detail=detail,
            error_code="EXTERNAL_SERVICE_ERROR",
        )


class ValidationError(AgentException):
    """参数校验异常"""

    def __init__(self, message: str, detail: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=400,
            detail=detail,
            error_code="VALIDATION_ERROR",
        )


class RateLimitError(AgentException):
    """并发限制异常"""

    def __init__(self, message: str = "请求过于频繁，请稍后重试", detail: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=429,
            detail=detail,
            error_code="RATE_LIMIT_ERROR",
        )


class TimeoutError(AgentException):
    """超时异常"""

    def __init__(self, message: str = "请求超时，请稍后重试", detail: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=504,
            detail=detail,
            error_code="TIMEOUT_ERROR",
        )


class ServiceUnavailableError(AgentException):
    """服务不可用异常"""

    def __init__(self, message: str = "服务暂时不可用，请稍后重试", detail: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=503,
            detail=detail,
            error_code="SERVICE_UNAVAILABLE",
        )
