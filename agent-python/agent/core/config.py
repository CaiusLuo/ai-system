"""应用配置。"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """通过环境变量注入的应用配置。"""

    deepseek_api_key: str | None = None
    deepseek_base_url: str | None = None
    deepseek_model: str = "deepseek-chat"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 4096
    llm_timeout: float = 60.0

    java_backend_url: str | None = None
    java_backend_timeout: float = 5.0

    app_name: str = "Job Agent API"
    app_version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 5001

    max_concurrent_streams: int = 1000
    per_user_stream_limit: int = 5

    stream_task_timeout: float = 600.0
    chunk_ttl: int = 3600

    llm_max_retries: int = 3
    llm_retry_base_delay: float = 1.0
    llm_retry_max_delay: float = 30.0

    cors_allow_origins: str = "*"

    langsmith_api_key: str | None = None
    langsmith_tracing: bool = False
    langsmith_project: str = "job-agent"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    def get_cors_origins(self) -> list[str]:
        if self.cors_allow_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_allow_origins.split(",")]

    def has_llm_config(self) -> bool:
        """判断 LLM 配置是否完整可用。"""
        return bool(self.deepseek_api_key and self.deepseek_base_url)


settings = Settings()
