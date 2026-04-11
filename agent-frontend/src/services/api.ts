// 统一 API 请求封装

import { getToken, removeToken } from './auth';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// HTTP 错误处理策略
class ApiError extends Error {
  constructor(
    public code: number,
    public httpStatus: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 处理认证失败
function handleUnauthorized(): void {
  removeToken();
  // 如果当前不在登录页面，跳转到登录页
  if (window.location.pathname !== '/auth') {
    window.location.href = '/auth';
  }
}

// 统一请求方法
export async function request<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 处理 401 未授权
  if (response.status === 401) {
    handleUnauthorized();
    throw new ApiError(401, 401, '认证失败，请重新登录');
  }

  // 处理 403 权限不足
  if (response.status === 403) {
    throw new ApiError(403, 403, '权限不足');
  }

  // 处理 404 资源不存在
  if (response.status === 404) {
    const errorText = await response.text();
    throw new ApiError(404, 404, errorText || '资源不存在');
  }

  // 处理其他 HTTP 错误
  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(
      response.status,
      response.status,
      `请求失败 (${response.status}): ${errorText}`
    );
  }

  const result: ApiResponse<T> = await response.json();

  // 检查业务状态码
  if (result.code !== 200) {
    throw new ApiError(result.code, response.status, result.message || '请求失败');
  }

  return result;
}

// 便捷方法
export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, data?: any, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(url: string, data?: any, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(url: string, data?: any, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};

export { ApiError };
