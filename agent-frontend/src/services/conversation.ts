// 会话服务

import { api, ApiResponse } from './api';
import { ConversationDTO, MessageDTO } from '../types';

export type { ConversationDTO, MessageDTO };

// 获取会话列表
export async function getConversationList(): Promise<ApiResponse<ConversationDTO[]>> {
  return api.get('/conversation/list');
}

// 获取会话消息列表
export async function getConversationMessages(id: number): Promise<ApiResponse<MessageDTO[]>> {
  return api.get(`/conversation/${id}/messages`);
}

// 删除会话
export async function deleteConversation(id: number): Promise<ApiResponse<null>> {
  return api.delete(`/conversation/${id}`);
}
