import { z } from 'zod';
import {
  currentUserResponseSchema,
  jwtPayloadSchema,
  loginParamsSchema,
  loginResponseSchema,
  registerParamsSchema,
  storedUserInfoSchema,
  updateUserParamsSchema,
  userDtoSchema,
} from './auth';
import {
  adminFeedbackMessageSchema,
  adminUserDtoSchema,
  adminUserFormSchema,
  createUserParamsSchema,
  updateAdminUserParamsSchema,
  userListParamsSchema,
  userListResponseSchema,
} from './admin';
import {
  abortRequestSchema,
  chatRequestSchema,
  chatResponseSchema,
  messageSchema,
  recoverStreamParamsSchema,
  sseChunkDataSchema,
  sseDoneDataSchema,
  sseErrorDataSchema,
  sseEventDataSchema,
  sseMessageIdDataSchema,
  ssePingDataSchema,
  streamChatParamsSchema,
} from './chat';
import { conversationDtoSchema, messageDtoSchema } from './conversation';
import {
  localConversationSummarySchema,
  storedConversationMapSchema,
  storedConversationSchema,
  storedMessageSchema,
} from './localChat';

export * from './api';
export * from './common';
export * from './auth';
export * from './admin';
export * from './chat';
export * from './conversation';
export * from './localChat';

export type LoginParams = z.infer<typeof loginParamsSchema>;
export type RegisterParams = z.infer<typeof registerParamsSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
export type UserDTO = z.infer<typeof userDtoSchema>;
export type UpdateUserParams = z.infer<typeof updateUserParamsSchema>;
export type StoredUserInfo = z.infer<typeof storedUserInfoSchema>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export type ConversationDTO = z.infer<typeof conversationDtoSchema>;
export type MessageDTO = z.infer<typeof messageDtoSchema>;

export type StreamChatParams = z.infer<typeof streamChatParamsSchema>;
export type RecoverStreamParams = z.infer<typeof recoverStreamParamsSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type AbortRequest = z.infer<typeof abortRequestSchema>;
export type SSEMessageIdData = z.infer<typeof sseMessageIdDataSchema>;
export type SSEChunkData = z.infer<typeof sseChunkDataSchema>;
export type SSEDoneData = z.infer<typeof sseDoneDataSchema>;
export type SSEErrorData = z.infer<typeof sseErrorDataSchema>;
export type SSEPingData = z.infer<typeof ssePingDataSchema>;
export type SEDoneData = SSEDoneData;
export type SEEErrorData = SSEErrorData;
export type SEPingData = SSEPingData;
export type SSEEventData = z.infer<typeof sseEventDataSchema>;
export type Message = z.infer<typeof messageSchema>;

export type AdminUserDTO = z.infer<typeof adminUserDtoSchema>;
export type UserListParams = z.infer<typeof userListParamsSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
export type CreateUserParams = z.infer<typeof createUserParamsSchema>;
export type UpdateAdminUserParams = z.infer<typeof updateAdminUserParamsSchema>;
export type AdminUserFormState = z.infer<typeof adminUserFormSchema>;
export type AdminFeedbackMessage = z.infer<typeof adminFeedbackMessageSchema>;

export type StoredMessage = z.infer<typeof storedMessageSchema>;
export type StoredConversation = z.infer<typeof storedConversationSchema>;
export type StoredConversationMap = z.infer<typeof storedConversationMapSchema>;
export type LocalConversationSummary = z.infer<typeof localConversationSummarySchema>;
export type LocalConversation = LocalConversationSummary;
