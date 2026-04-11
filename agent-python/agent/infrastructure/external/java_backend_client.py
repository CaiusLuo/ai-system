
"""Java 后端客户端实现"""
import logging

import httpx

from ...domain.entities import Message
from ...domain.protocols import ConversationRepository

logger = logging.getLogger(__name__)


class JavaBackendClient(ConversationRepository):
    """Java 后端 HTTP 客户端 - 实现 ConversationRepository 协议"""

    def __init__(self, base_url: str, timeout: float = 5.0):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

        if not base_url:
            logger.warning("Java 后端 URL 未配置，历史消息功能将不可用")

    async def get_history(
        self,
        conversation_id: int,
        token: str,
    ) -> list[Message]:
        """获取会话历史消息"""
        # 跳过条件：conversation_id 为 0 或 token 为空
        if conversation_id == 0 or not token:
            logger.debug(f"跳过历史消息获取：conversation_id={conversation_id}, token_present={bool(token)}")
            return []

        if not self._base_url:
            logger.debug("跳过历史消息获取：Java 后端 URL 未配置")
            return []

        url = f"{self._base_url}/conversation/{conversation_id}/messages"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()

                if data.get("code") == 200:
                    return data.get("data", [])
                return []

        except httpx.ConnectError:
            logger.warning("无法连接到 Java 后端，使用空历史继续")
            return []
        except httpx.TimeoutException:
            logger.warning("连接 Java 后端超时，使用空历史继续")
            return []
        except Exception as e:
            logger.warning(f"获取会话历史异常: {e}")
            return []
