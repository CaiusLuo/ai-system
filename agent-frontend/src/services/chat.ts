import { chatRequestSchema, chatResponseSchema, type ChatRequest, type ChatResponse } from '../schemas';
import { getAuthStatus, redirectToLogin } from './auth';
import { api, type ApiResponse } from './api';

export async function chat(data: ChatRequest): Promise<ApiResponse<ChatResponse>> {
  const authStatus = getAuthStatus();
  if (authStatus === 'expired') {
    redirectToLogin('session-expired');
    throw new Error('登录已过期，请重新登录');
  }

  if (authStatus === 'invalid') {
    redirectToLogin('unauthorized');
    throw new Error('登录信息无效，请重新登录');
  }

  return api.post('/agent/chat', data, chatResponseSchema, chatRequestSchema);
}
