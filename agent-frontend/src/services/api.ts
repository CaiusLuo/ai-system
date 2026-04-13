import { z } from 'zod';
import { apiResponseEnvelopeSchema } from '../schemas';
import { getAuthStatus, getToken, redirectToLogin, removeToken } from './auth';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestConfig<TRequest, TResponse> = {
  url: string;
  method: HttpMethod;
  body?: TRequest;
  requestSchema?: z.ZodType<TRequest>;
  responseSchema: z.ZodType<TResponse>;
  options?: Omit<RequestInit, 'body' | 'method'>;
};

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

function handleUnauthorized(): void {
  const authStatus = getAuthStatus();
  if (authStatus === 'expired') {
    redirectToLogin('session-expired');
    return;
  }

  removeToken();
  redirectToLogin('unauthorized');
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
  context: string,
  errorCode = 500,
  httpStatus = 500
): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  console.error(`[Schema] ${context} validation failed`, result.error.flatten());
  throw new ApiError(errorCode, httpStatus, `${context}数据结构校验失败`);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      response.status,
      response.status,
      '服务端返回了无效的 JSON 数据'
    );
  }
}

export async function request<TRequest = undefined, TResponse = unknown>({
  url,
  method,
  body,
  requestSchema,
  responseSchema,
  options,
}: RequestConfig<TRequest, TResponse>): Promise<ApiResponse<TResponse>> {
  const authStatus = getAuthStatus();
  if (authStatus === 'expired') {
    redirectToLogin('session-expired');
    throw new ApiError(401, 401, '登录已过期，请重新登录');
  }

  if (authStatus === 'invalid') {
    redirectToLogin('unauthorized');
    throw new ApiError(401, 401, '登录信息无效，请重新登录');
  }

  const validatedBody = requestSchema
    ? parseWithSchema(requestSchema, body, `${method} ${url} 请求参数`, 400, 400)
    : body;

  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    body: validatedBody === undefined ? undefined : JSON.stringify(validatedBody),
  });

  if (response.status === 401) {
    let errorMessage = '认证失败，请重新登录';

    try {
      const errorData = await response.json();
      errorMessage = errorData?.message || errorMessage;
    } catch {
      // keep fallback message
    }

    if (errorMessage.includes('过期')) {
      redirectToLogin('session-expired');
    } else {
      handleUnauthorized();
    }

    throw new ApiError(401, 401, errorMessage);
  }

  if (response.status === 403) {
    throw new ApiError(403, 403, '权限不足');
  }

  if (response.status === 404) {
    const errorText = await response.text();
    throw new ApiError(404, 404, errorText || '资源不存在');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(
      response.status,
      response.status,
      `请求失败 (${response.status}): ${errorText}`
    );
  }

  const rawResult = await parseJsonResponse(response);
  const envelope = parseWithSchema(
    apiResponseEnvelopeSchema,
    rawResult,
    `${method} ${url} 响应包`,
    500,
    response.status
  );

  if (envelope.code !== 200) {
    throw new ApiError(
      envelope.code,
      response.status,
      envelope.message || '请求失败'
    );
  }

  return {
    ...envelope,
    data: parseWithSchema(
      responseSchema,
      envelope.data,
      `${method} ${url} 响应数据`,
      500,
      response.status
    ),
  };
}

export const api = {
  get<TResponse>(
    url: string,
    responseSchema: z.ZodType<TResponse>,
    options?: Omit<RequestInit, 'body' | 'method'>
  ) {
    return request<undefined, TResponse>({
      url,
      method: 'GET',
      responseSchema,
      options,
    });
  },

  post<TRequest, TResponse>(
    url: string,
    body: TRequest,
    responseSchema: z.ZodType<TResponse>,
    requestSchema?: z.ZodType<TRequest>,
    options?: Omit<RequestInit, 'body' | 'method'>
  ) {
    return request<TRequest, TResponse>({
      url,
      method: 'POST',
      body,
      requestSchema,
      responseSchema,
      options,
    });
  },

  put<TRequest, TResponse>(
    url: string,
    body: TRequest,
    responseSchema: z.ZodType<TResponse>,
    requestSchema?: z.ZodType<TRequest>,
    options?: Omit<RequestInit, 'body' | 'method'>
  ) {
    return request<TRequest, TResponse>({
      url,
      method: 'PUT',
      body,
      requestSchema,
      responseSchema,
      options,
    });
  },

  patch<TRequest, TResponse>(
    url: string,
    body: TRequest,
    responseSchema: z.ZodType<TResponse>,
    requestSchema?: z.ZodType<TRequest>,
    options?: Omit<RequestInit, 'body' | 'method'>
  ) {
    return request<TRequest, TResponse>({
      url,
      method: 'PATCH',
      body,
      requestSchema,
      responseSchema,
      options,
    });
  },

  delete<TResponse>(
    url: string,
    responseSchema: z.ZodType<TResponse>,
    options?: Omit<RequestInit, 'body' | 'method'>
  ) {
    return request<undefined, TResponse>({
      url,
      method: 'DELETE',
      responseSchema,
      options,
    });
  },
};

export { ApiError };
