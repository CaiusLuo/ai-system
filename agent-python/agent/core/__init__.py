"""Core 模块

核心层提供：
- config: 应用配置管理
- exceptions: 业务异常定义
- logging: 结构化日志配置
- middleware: 请求中间件
- sse: SSE 格式化工具
- abort: 中断控制器
- retry: 重试机制
"""
from agent.core.abort import AbortController
from agent.core.config import Settings, settings
from agent.core.exceptions import (
    AgentException,
    ExternalServiceError,
    LLMServiceError,
    RateLimitError,
    ServiceUnavailableError,
    TimeoutError,
    ValidationError,
)
from agent.core.retry import RetryExhaustedError, retry, retry_async
from agent.core.sse import (
    create_chunk_event,
    create_done_event,
    create_error_event,
    create_ping_event,
    format_sse,
)

__all__ = [
    "settings",
    "Settings",
    "AgentException",
    "LLMServiceError",
    "ExternalServiceError",
    "ValidationError",
    "RateLimitError",
    "TimeoutError",
    "ServiceUnavailableError",
    "format_sse",
    "create_chunk_event",
    "create_done_event",
    "create_error_event",
    "create_ping_event",
    "AbortController",
    "retry",
    "retry_async",
    "RetryExhaustedError",
]
