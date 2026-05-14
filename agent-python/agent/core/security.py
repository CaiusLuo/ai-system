"""安全相关依赖。"""

from __future__ import annotations

import secrets

from fastapi import Header

from agent.core.config import settings
from agent.core.exceptions import InternalTokenError


def verify_internal_token(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> None:
    """校验 Java 内网调用 token。"""

    expected_token = (settings.internal_api_token or "").strip()
    received_token = (x_internal_token or "").strip()

    if not expected_token:
        return

    if not received_token or not secrets.compare_digest(received_token, expected_token):
        raise InternalTokenError(message="internal token validation failed")
