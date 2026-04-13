import { z } from 'zod';
import {
  chatRoleSchema,
  idSchema,
  localTimestampSchema,
} from './common';

export const storedMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string(),
  reasoning: z.string().optional(),
  timestamp: localTimestampSchema,
});

export const storedConversationSchema = z.object({
  id: idSchema.nullable(),
  backendId: idSchema.optional(),
  title: z.string(),
  messages: z.array(storedMessageSchema),
  lastMessageContent: z.string().nullable(),
  lastMessageTime: z.string().nullable(),
  createdAt: localTimestampSchema,
  updatedAt: localTimestampSchema,
});

export const storedConversationMapSchema = z.record(
  z.string(),
  storedConversationSchema
);

export const localConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  backendId: idSchema.nullable(),
  updatedAt: localTimestampSchema,
  lastMessageContent: z.string().nullable(),
  lastMessageTime: z.string().nullable(),
});
