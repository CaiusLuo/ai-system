"""服务实例工厂。"""

from __future__ import annotations

from functools import lru_cache

from agent.core.config import settings
from agent.services.agent_service import AgentService
from agent.services.pdf_service import PdfService
from agent.services.storage_service import MinioStorageService


@lru_cache
def get_storage_service() -> MinioStorageService:
    """获取单例 MinIO 存储服务。"""

    return MinioStorageService(
        endpoint=settings.oss_endpoint,
        access_key=settings.oss_access_key,
        secret_key=settings.oss_secret_key,
        secure=settings.oss_secure,
    )


@lru_cache
def get_pdf_service() -> PdfService:
    """获取单例 PDF 服务。"""

    return PdfService(storage_service=get_storage_service())


@lru_cache
def get_agent_service() -> AgentService:
    """获取单例 Agent 服务。"""

    return AgentService()
