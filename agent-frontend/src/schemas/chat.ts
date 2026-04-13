import { z } from 'zod';
import {
  chatRoleSchema,
  idSchema,
  timestampStringSchema,
} from './common';

const requestMessageSchema = z.string().trim().min(1, '消息内容不能为空');

export const streamChatParamsSchema = z.object({
  message: requestMessageSchema,
  conversationId: idSchema.optional(),
  sessionId: z.string().optional(),
});

export const recoverStreamParamsSchema = z.object({
  conversationId: idSchema,
  messageId: z.string().min(1, '消息 ID 不能为空'),
  lastEventId: z.string().optional(),
});

export const chatRequestSchema = z.object({
  message: requestMessageSchema,
  conversationId: idSchema.optional(),
});

export const chatResponseSchema = z.object({
  reply: z.string(),
  conversationId: idSchema,
});

export const abortRequestSchema = z.object({
  messageId: z.string().min(1, '消息 ID 不能为空'),
});

export const sseMessageIdDataSchema = z.object({
  type: z.literal('message_id'),
  messageId: z.string().min(1),
});

export const sseChunkDataSchema = z.object({
  type: z.literal('chunk'),
  content: z.string(),
  index: z.number().int().nonnegative(),
  reasoning: z.string().optional(),
  info: z.string().optional(),
  conversationId: idSchema.optional(),
});

export const sseDoneDataSchema = z.object({
  type: z.literal('done'),
  info: z.string(),
  conversationId: idSchema,
  messageId: z.string().min(1),
});

export const sseErrorDataSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const ssePingDataSchema = z.object({
  type: z.literal('ping'),
});

export const sseEventDataSchema = z.discriminatedUnion('type', [
  sseMessageIdDataSchema,
  sseChunkDataSchema,
  sseDoneDataSchema,
  sseErrorDataSchema,
  ssePingDataSchema,
]);

export const messageSchema = z.object({
  id: idSchema.optional(),
  messageId: z.string().optional(),
  conversationId: idSchema.optional(),
  userId: idSchema.optional(),
  username: z.string().nullable().optional(),
  role: chatRoleSchema,
  content: z.string(),
  title: z.string().nullable().optional(),
  reasoning: z.string().optional(),
  createdAt: timestampStringSchema.optional(),
  updatedAt: timestampStringSchema.optional(),
});
