"""Abort 控制器 - 管理流式生成的中断标志

支持两种 abort key：
- conversation_id (int): 向后兼容
- message_id (str): 对接文档标准（Java 后端传入的 messageId）

增加 TTL 机制：每个 abort flag 带有创建时间戳，
超过 TTL 后自动清理，防止内存泄漏和后续请求误中断。
"""
import asyncio
import logging
import time
from typing import Dict, Union

logger = logging.getLogger(__name__)


class AbortController:
    """
    内存中的 Abort 标志管理器

    每个 key（conversation_id 或 message_id）对应一个 asyncio.Event，
    前端/外部系统调用 abort() 设置标志，
    流式生成循环中检查该标志决定是否中断。

    TTL 机制：
    - 每个条目带有创建时间戳
    - is_aborted() 时自动清理过期条目
    - 正常结束/异常结束时由调用方显式 clear()
    """

    def __init__(self, ttl: int = 3600):
        """
        Args:
            ttl: abort flag 存活时间（秒），默认 1 小时
        """
        # Dict[key, (asyncio.Event, created_at_timestamp)]
        self._flags: Dict[Union[int, str], tuple[asyncio.Event, float]] = {}
        self._ttl = ttl

    def abort(self, key: Union[int, str]) -> None:
        """
        标记中断

        Args:
            key: conversation_id (int) 或 message_id (str)
        """
        if key not in self._flags:
            self._flags[key] = (asyncio.Event(), time.time())
        self._flags[key][0].set()
        logger.info(f"已标记中断 | key={key}")

    def is_aborted(self, key: Union[int, str]) -> bool:
        """
        检查是否已中断，同时清理过期条目

        Args:
            key: conversation_id (int) 或 message_id (str)

        Returns:
            True 表示已中断
        """
        entry = self._flags.get(key)
        if entry is None:
            return False

        event, created_at = entry

        # 自动清理过期条目
        if time.time() - created_at > self._ttl:
            self._flags.pop(key, None)
            logger.debug(f"Abort flag 已过期，自动清理 | key={key}")
            return False

        return event.is_set()

    def clear(self, key: Union[int, str]) -> None:
        """
        清除中断标志

        Args:
            key: conversation_id (int) 或 message_id (str)
        """
        self._flags.pop(key, None)

    def size(self) -> int:
        """返回当前存储的 abort flag 数量（用于监控）"""
        return len(self._flags)
