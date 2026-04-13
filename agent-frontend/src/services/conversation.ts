import { z } from 'zod';
import {
  conversationDtoSchema,
  messageDtoSchema,
  type ConversationDTO,
  type MessageDTO,
} from '../schemas';
import { api, type ApiResponse } from './api';

export type { ConversationDTO, MessageDTO };

export async function getConversationList(): Promise<ApiResponse<ConversationDTO[]>> {
  return api.get('/conversation/list', z.array(conversationDtoSchema));
}

export async function getConversationMessages(
  id: number
): Promise<ApiResponse<MessageDTO[]>> {
  return api.get(`/conversation/${id}/messages`, z.array(messageDtoSchema));
}

export async function deleteConversation(id: number): Promise<ApiResponse<null>> {
  return api.delete(`/conversation/${id}`, z.null());
}
