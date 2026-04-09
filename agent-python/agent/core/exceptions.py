"""业务异常定义"""
from typing import Any, Optional


class AgentException(Exception):
    """Agent 业务异常基类"""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        detail: Optional[Any] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class LLMServiceError(AgentException):
    """LLM 服务调用异常"""

    def __init__(self, message: str, detail: Optional[Any] = None):
        super().__init__(message=message, status_code=502, detail=detail)


class ExternalServiceError(AgentException):
    """外部服务调用异常"""

    def __init__(self, message: str, detail: Optional[Any] = None):
        super().__init__(message=message, status_code=502, detail=detail)


class ValidationError(AgentException):
    """参数校验异常"""

    def __init__(self, message: str, detail: Optional[Any] = None):
        super().__init__(message=message, status_code=400, detail=detail)
