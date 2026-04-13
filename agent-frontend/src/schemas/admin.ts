import { z } from 'zod';
import {
  emailSchema,
  idSchema,
  optionalPasswordSchema,
  requiredPasswordSchema,
  userRoleSchema,
  userStatusTextSchema,
  usernameSchema,
} from './common';

export const adminUserDtoSchema = z.object({
  id: idSchema,
  username: z.string(),
  email: z.string(),
  role: userRoleSchema,
  status: userStatusTextSchema,
  createdAt: z.string(),
});

export const userListParamsSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  keyword: z.string().trim().min(1).optional(),
  role: userRoleSchema.optional(),
  status: userStatusTextSchema.optional(),
});

export const userListResponseSchema = z.object({
  list: z.array(adminUserDtoSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const createUserParamsSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: requiredPasswordSchema,
  role: userRoleSchema,
  status: userStatusTextSchema,
});

export const updateAdminUserParamsSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  password: requiredPasswordSchema.optional(),
  role: userRoleSchema.optional(),
  status: userStatusTextSchema.optional(),
});

export const adminUserFormSchema = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
  role: userRoleSchema,
  status: userStatusTextSchema,
});

export const createAdminUserFormSchema = adminUserFormSchema.extend({
  username: usernameSchema,
  email: emailSchema,
  password: requiredPasswordSchema,
});

export const updateAdminUserFormSchema = adminUserFormSchema.extend({
  username: usernameSchema,
  email: emailSchema,
  password: optionalPasswordSchema,
});

export const adminFeedbackMessageSchema = z.object({
  type: z.enum(['success', 'error']),
  text: z.string(),
});
