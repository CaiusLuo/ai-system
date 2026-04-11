from typing import List, Optional

"""应用配置 - 通过环境变量注入，不暴露敏感默认值

企业级配置：
- LLM 配置
- 服务配置
- 并发控制
- 超时设置
- 重试策略
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""

    # ========================================
    # LLM 配置
    # ========================================
    deepseek_api_key: str
    deepseek_base_url: str
    deepseek_model: str = "deepseek-chat"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 4096
    llm_timeout: float = 60.0  # LLM 调用超时（秒）

    # ========================================
    # 外部服务
    # ========================================
    java_backend_url: Optional[str] = None
    java_backend_timeout: float = 5.0

    # ========================================
    # 应用配置
    # ========================================
    app_name: str = "Job Agent API"
    app_version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 5001

    # ========================================
    # 并发控制
    # ========================================
    max_concurrent_streams: int = 1000  # 全局最大并发流
    per_user_stream_limit: int = 5  # 单用户最大流数

    # ========================================
    # 超时设置
    # ========================================
    stream_task_timeout: float = 600.0  # 流式任务超时（秒，默认 10 分钟）
    chunk_ttl: int = 3600  # Redis chunk TTL（秒，预留）

    # ========================================
    # 重试策略
    # ========================================
    llm_max_retries: int = 3
    llm_retry_base_delay: float = 1.0
    llm_retry_max_delay: float = 30.0

    # ========================================
    # CORS
    # ========================================
    cors_allow_origins: str = "*"  # 逗号分隔的域名列表，或 "*" 表示所有

    # ========================================
    # LangSmith（可选）
    # ========================================
    langsmith_api_key: Optional[str] = None
    langsmith_tracing: bool = False
    langsmith_project: str = "job-agent"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_cors_origins(self) -> List[str]:
        """获取 CORS 允许的源列表"""
        if self.cors_allow_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_allow_origins.split(",")]


settings = Settings()
