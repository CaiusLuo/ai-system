"""业务异常定义

企业级异常体系：
- 明确的错误码和 HTTP 状态码映射
- 支持错误详情追踪
- 友好的错误消息国际化（预留）
"""

from typing import Any


class AgentException(Exception):  # noqa: N818
    """Agent 业务异常基类"""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        detail: Any | None = None,
        error_code: str = "INTERNAL_ERROR",
        code: int = 5000,
    ):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        self.code = code
        super().__init__(message)

    def to_dict(self) -> dict[str, Any | None]:
        """转换为统一响应结构。"""
        payload: dict[str, Any | None] = {
            "success": False,
            "data": None,
            "message": self.message,
            "code": self.code,
        }
        if self.detail is not None:
            payload["detail"] = self.detail
        payload["error_code"] = self.error_code
        return payload


class LLMServiceError(AgentException):
    """LLM 服务调用异常"""

    def __init__(self, message: str, detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=502,
            detail=detail,
            error_code="LLM_SERVICE_ERROR",
            code=5021,
        )


class ExternalServiceError(AgentException):
    """外部服务调用异常"""

    def __init__(self, message: str, detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=502,
            detail=detail,
            error_code="EXTERNAL_SERVICE_ERROR",
            code=5022,
        )


class ValidationError(AgentException):
    """参数校验异常"""

    def __init__(self, message: str, detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=400,
            detail=detail,
            error_code="VALIDATION_ERROR",
            code=4000,
        )


class RateLimitError(AgentException):
    """并发限制异常"""

    def __init__(self, message: str = "请求过于频繁，请稍后重试", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=429,
            detail=detail,
            error_code="RATE_LIMIT_ERROR",
            code=4290,
        )


class TimeoutError(AgentException):
    """超时异常"""

    def __init__(self, message: str = "请求超时，请稍后重试", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=504,
            detail=detail,
            error_code="TIMEOUT_ERROR",
            code=5040,
        )


class ServiceUnavailableError(AgentException):
    """服务不可用异常"""

    def __init__(self, message: str = "服务暂时不可用，请稍后重试", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=503,
            detail=detail,
            error_code="SERVICE_UNAVAILABLE",
            code=5030,
        )


class InternalTokenError(AgentException):
    """内部调用 token 校验失败。"""

    def __init__(self, message: str = "invalid internal token", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=401,
            detail=detail,
            error_code="INTERNAL_TOKEN_INVALID",
            code=4001,
        )


class MinioObjectNotFoundError(AgentException):
    """MinIO 对象不存在。"""

    def __init__(self, message: str = "pdf file not found", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=404,
            detail=detail,
            error_code="MINIO_OBJECT_NOT_FOUND",
            code=4041,
        )


class PdfDownloadError(AgentException):
    """PDF 下载失败。"""

    def __init__(self, message: str = "pdf download failed", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=502,
            detail=detail,
            error_code="PDF_DOWNLOAD_FAILED",
            code=5002,
        )


class PdfParseError(AgentException):
    """PDF 解析失败。"""

    def __init__(self, message: str = "pdf parse failed", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=500,
            detail=detail,
            error_code="PDF_PARSE_FAILED",
            code=5001,
        )


class AgentProcessError(AgentException):
    """Agent 处理失败。"""

    def __init__(self, message: str = "agent process failed", detail: Any | None = None):
        super().__init__(
            message=message,
            status_code=500,
            detail=detail,
            error_code="AGENT_PROCESS_FAILED",
            code=5003,
        )
