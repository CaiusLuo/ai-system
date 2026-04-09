// 会话服务

import { getToken } from './auth';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  userId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// 通用请求方法
async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  return response.json();
}

// 获取会话列表
export async function getConversationList(): Promise<ApiResponse<Conversation[]>> {
  return request('/conversation/list');
}

// 获取会话消息列表
export async function getConversationMessages(id: number): Promise<ApiResponse<Message[]>> {
  return request(`/conversation/${id}/messages`);
}

// 删除会话
export async function deleteConversation(id: number): Promise<ApiResponse<null>> {
  return request(`/conversation/${id}`, {
    method: 'DELETE',
  });
}
