import { z } from 'zod';
import {
  chatRoleSchema,
  idSchema,
  timestampStringSchema,
} from './common';

export const conversationDtoSchema = z.object({
  id: idSchema,
  userId: idSchema,
  title: z.string(),
  lastMessageContent: z.string().nullable(),
  lastMessageTime: z.string().nullable(),
  createdAt: timestampStringSchema,
  updatedAt: timestampStringSchema,
});

export const messageDtoSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  userId: idSchema,
  username: z.string().nullable(),
  role: chatRoleSchema,
  content: z.string(),
  title: z.string().nullable(),
  createdAt: timestampStringSchema,
  updatedAt: timestampStringSchema,
});
