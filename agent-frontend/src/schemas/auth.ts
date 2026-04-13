import { z } from 'zod';
import {
  emailSchema,
  idSchema,
  loginPasswordSchema,
  loginUsernameSchema,
  requiredPasswordSchema,
  userRoleSchema,
  userStatusCodeSchema,
  userStatusTextSchema,
  usernameSchema,
} from './common';

export const loginParamsSchema = z.object({
  username: loginUsernameSchema,
  password: loginPasswordSchema,
});

export const registerParamsSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: requiredPasswordSchema,
});

export const loginResponseSchema = z.object({
  token: z.string(),
  userId: idSchema,
  username: z.string(),
  role: userRoleSchema,
  expiresAt: z.number().optional(),
  expiresInSeconds: z.number().optional(),
});

export const currentUserResponseSchema = z.object({
  userId: idSchema,
  username: z.string(),
  role: userRoleSchema,
  expiresAt: z.number().optional(),
  expiresInSeconds: z.number().optional(),
  expired: z.boolean().optional(),
  status: userStatusCodeSchema.optional(),
  statusText: userStatusTextSchema.optional(),
});

export const userDtoSchema = z.object({
  id: idSchema,
  username: z.string(),
  email: z.string(),
  role: userRoleSchema,
  status: userStatusCodeSchema,
  statusText: userStatusTextSchema,
});

export const updateUserParamsSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  password: requiredPasswordSchema.optional(),
});

export const storedUserInfoSchema = z.object({
  userId: idSchema,
  username: z.string(),
  role: userRoleSchema,
  status: userStatusTextSchema.optional(),
});

export const jwtPayloadSchema = z
  .object({
    exp: z.number().optional(),
  })
  .passthrough();
