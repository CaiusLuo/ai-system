"""重试机制工具

企业级重试策略：
- 指数退避（Exponential Backoff）
- 最大重试次数控制
- 可重试异常判断
- 异步支持
"""
import asyncio
import logging
from collections.abc import Callable
from functools import wraps

logger = logging.getLogger(__name__)

# 默认可重试异常类型
DEFAULT_RETRYABLE_EXCEPTIONS = (
    ConnectionError,
    TimeoutError,
    OSError,
)


class RetryExhaustedError(Exception):
    """重试耗尽异常"""

    def __init__(self, message: str, last_exception: Exception = None):
        self.message = message
        self.last_exception = last_exception
        super().__init__(message)


def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    retryable_exceptions: tuple[type[Exception], ...] = DEFAULT_RETRYABLE_EXCEPTIONS,
    jitter: bool = True,
):
    """
    异步重试装饰器

    Args:
        max_attempts: 最大重试次数（包括首次调用）
        base_delay: 基础延迟（秒）
        max_delay: 最大延迟（秒）
        exponential_base: 指数基数
        retryable_exceptions: 可重试的异常类型
        jitter: 是否添加随机抖动（避免惊群效应）

    使用示例：
        @retry(max_attempts=3, base_delay=1.0)
        async def call_llm(messages):
            return await llm.ainvoke(messages)
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e

                    if attempt < max_attempts - 1:
                        # 计算延迟：指数退避 + 可选抖动
                        delay = min(
                            base_delay * (exponential_base ** attempt),
                            max_delay,
                        )

                        if jitter:
                            import random
                            delay = delay * (0.5 + random.random() * 0.5)

                        logger.warning(
                            f"{func.__name__} 第 {attempt + 1} 次尝试失败，"
                            f"{delay:.2f}s 后重试: {e}"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"{func.__name__} 重试 {max_attempts} 次后失败: {e}",
                            exc_info=True,
                        )

            raise RetryExhaustedError(
                f"{func.__name__} 重试 {max_attempts} 次后失败",
                last_exception,
            )

        return wrapper
    return decorator


async def retry_async(
    func: Callable,
    *args,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    retryable_exceptions: tuple[type[Exception], ...] = DEFAULT_RETRYABLE_EXCEPTIONS,
    **kwargs,
):
    """
    异步重试函数（非装饰器版本）

    Args:
        func: 异步函数
        *args: 位置参数
        max_attempts: 最大重试次数
        base_delay: 基础延迟
        max_delay: 最大延迟
        retryable_exceptions: 可重试的异常
        **kwargs: 关键字参数

    Returns:
        函数执行结果

    Raises:
        RetryExhaustedError: 重试耗尽时抛出
    """
    last_exception = None

    for attempt in range(max_attempts):
        try:
            return await func(*args, **kwargs)
        except retryable_exceptions as e:
            last_exception = e

            if attempt < max_attempts - 1:
                delay = min(base_delay * (2 ** attempt), max_delay)
                logger.warning(
                    f"重试 {func.__name__} (尝试 {attempt + 1}/{max_attempts}), "
                    f"等待 {delay:.2f}s: {e}"
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    f"{func.__name__} 重试 {max_attempts} 次后失败: {e}",
                    exc_info=True,
                )

    raise RetryExhaustedError(
        f"{func.__name__} 重试 {max_attempts} 次后失败",
        last_exception,
    )
