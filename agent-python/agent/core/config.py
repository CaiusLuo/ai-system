"""应用配置。"""

from pydantic import AliasChoices, Field
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

    app_name: str = Field(
        default="agent-python",
        validation_alias=AliasChoices("APP_NAME"),
    )
    app_version: str = Field(
        default="1.0.0",
        validation_alias=AliasChoices("APP_VERSION"),
    )
    app_env: str = Field(
        default="dev",
        validation_alias=AliasChoices("APP_ENV"),
    )
    debug: bool = False
    host: str = Field(
        default="0.0.0.0",
        validation_alias=AliasChoices("APP_HOST", "HOST"),
    )
    port: int = Field(
        default=8000,
        validation_alias=AliasChoices("APP_PORT", "PORT"),
    )

    internal_api_token: str = Field(
        default="change-me",
        validation_alias=AliasChoices("INTERNAL_API_TOKEN"),
    )

    minio_endpoint: str = Field(
        default="127.0.0.1:9000",
        validation_alias=AliasChoices("OSS_ENDPOINT", "MINIO_ENDPOINT"),
    )
    minio_access_key: str = Field(
        default="minioadmin",
        validation_alias=AliasChoices("OSS_ACCESS_KEY", "MINIO_ACCESS_KEY"),
    )
    minio_secret_key: str = Field(
        default="minioadmin",
        validation_alias=AliasChoices("OSS_SECRET_KEY", "MINIO_SECRET_KEY"),
    )
    minio_secure: bool = Field(
        default=False,
        validation_alias=AliasChoices("OSS_SECURE", "MINIO_SECURE"),
    )

    pdf_chunk_size: int = Field(
        default=1000,
        ge=100,
        validation_alias=AliasChoices("PDF_CHUNK_SIZE"),
    )
    pdf_chunk_overlap: int = Field(
        default=200,
        ge=0,
        validation_alias=AliasChoices("PDF_CHUNK_OVERLAP"),
    )

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

    def get_pdf_chunk_config(self) -> tuple[int, int]:
        """返回安全的切片配置，避免 overlap 大于 size。"""
        if self.pdf_chunk_overlap >= self.pdf_chunk_size:
            return self.pdf_chunk_size, max(0, self.pdf_chunk_size // 5)
        return self.pdf_chunk_size, self.pdf_chunk_overlap


settings = Settings()
