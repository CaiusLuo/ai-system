from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置 - 通过环境变量注入，不暴露敏感默认值"""

    # LLM 配置
    deepseek_api_key: str
    deepseek_base_url: str
    deepseek_model: str = "deepseek-chat"
    llm_temperature: float = 0.7

    # 外部服务
    java_backend_url: Optional[str] = None
    java_backend_timeout: float = 5.0

    # 应用配置
    app_name: str = "Job Agent API"
    app_version: str = "1.0.0"
    debug: bool = False

    # LangSmith（可选）
    langsmith_api_key: Optional[str] = None
    langsmith_tracing: bool = False
    langsmith_project: str = "job-agent"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
