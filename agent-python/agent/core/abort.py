"""Abort 控制器 - 管理流式生成的中断标志

支持两种 abort key：
- conversation_id (int): 向后兼容
- message_id (str): 对接文档标准（Java 后端传入的 messageId）
"""
import asyncio
import logging
from typing import Dict, Union

logger = logging.getLogger(__name__)


class AbortController:
    """
    内存中的 Abort 标志管理器

    每个 key（conversation_id 或 message_id）对应一个 asyncio.Event，
    前端/外部系统调用 abort() 设置标志，
    流式生成循环中检查该标志决定是否中断。
    """

    def __init__(self):
        self._flags: Dict[Union[int, str], asyncio.Event] = {}

    def abort(self, key: Union[int, str]) -> None:
        """
        标记中断

        Args:
            key: conversation_id (int) 或 message_id (str)
        """
        if key not in self._flags:
            self._flags[key] = asyncio.Event()
        self._flags[key].set()
        logger.info(f"已标记中断 | key={key}")

    def is_aborted(self, key: Union[int, str]) -> bool:
        """
        检查是否已中断

        Args:
            key: conversation_id (int) 或 message_id (str)

        Returns:
            True 表示已中断
        """
        event = self._flags.get(key)
        if event is None:
            return False
        return event.is_set()

    def clear(self, key: Union[int, str]) -> None:
        """
        清除中断标志

        Args:
            key: conversation_id (int) 或 message_id (str)
        """
        self._flags.pop(key, None)
