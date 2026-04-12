// 非流式对话服务

import { getAuthStatus, redirectToLogin } from './auth';
import { api, ApiResponse } from './api';
import { ChatRequest, ChatResponse } from '../types';

/**
 * 发起非流式对话请求
 * 
 * @param data 对话参数
 * @returns AI 回复和会话 ID
 */
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

  return api.post<ChatResponse>('/agent/chat', data);
}
