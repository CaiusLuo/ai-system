"""配置管理测试"""
import pytest
import os
from agent.core.config import Settings


class TestSettings:
    """测试 Settings 类"""

    def test_default_values(self):
        """测试默认值"""
        # 注意：实际测试时需要设置环境变量或使用 mock
        # 这里仅测试 get_cors_origins 方法
        pass

    def test_get_cors_origins_wildcard(self):
        """测试通配符 CORS"""
        settings = Settings.model_construct(
            cors_allow_origins="*"
        )
        assert settings.get_cors_origins() == ["*"]

    def test_get_cors_origins_list(self):
        """测试域名列表"""
        settings = Settings.model_construct(
            cors_allow_origins="http://localhost:3000,https://example.com"
        )
        assert settings.get_cors_origins() == [
            "http://localhost:3000",
            "https://example.com",
        ]

    def test_get_cors_origins_with_spaces(self):
        """测试域名列表带空格"""
        settings = Settings.model_construct(
            cors_allow_origins="http://localhost:3000, https://example.com , https://test.com"
        )
        assert settings.get_cors_origins() == [
            "http://localhost:3000",
            "https://example.com",
            "https://test.com",
        ]
