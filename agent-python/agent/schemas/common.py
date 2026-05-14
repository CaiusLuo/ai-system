"""通用 API 响应模型。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    """支持字段别名（camelCase）的基础模型。"""

    model_config = ConfigDict(populate_by_name=True)


class ApiResponse[T](CamelModel):
    """统一响应结构。"""

    success: bool = Field(..., description="是否成功")
    data: T | None = Field(default=None, description="响应数据")
    message: str = Field(default="ok", description="提示信息")
    code: int = Field(default=0, description="业务状态码")


def success_response[T](data: T, message: str = "ok") -> ApiResponse[T]:
    """构造成功响应。"""

    return ApiResponse(success=True, data=data, message=message, code=0)


def error_response(message: str, code: int, data: object | None = None) -> ApiResponse[None]:
    """构造失败响应。"""

    return ApiResponse(success=False, data=data, message=message, code=code)
