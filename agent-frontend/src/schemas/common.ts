import { z } from 'zod';

export const idSchema = z.number().int().nonnegative();
export const timestampStringSchema = z.string();
export const localTimestampSchema = z.number().int().nonnegative();

export const userRoleSchema = z.enum(['ADMIN', 'USER']);
export const chatRoleSchema = z.enum(['user', 'assistant']);
export const userStatusCodeSchema = z.union([z.literal(0), z.literal(1)]);
export const userStatusTextSchema = z.enum(['ACTIVE', 'DISABLED']);

export const loginUsernameSchema = z.string().trim().min(1, '用户名不能为空');
export const loginPasswordSchema = z
  .string()
  .refine((value) => value.trim().length > 0, '密码不能为空');

export const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名长度必须在 3-50 之间')
  .max(50, '用户名长度必须在 3-50 之间');

export const emailSchema = z
  .string()
  .trim()
  .min(1, '邮箱不能为空')
  .email('邮箱格式不正确');

export const requiredPasswordSchema = z
  .string()
  .min(6, '密码长度至少 6 位')
  .max(50, '密码长度必须在 6-50 之间')
  .refine((value) => value.trim().length > 0, '密码不能为空');

export const optionalPasswordSchema = z
  .string()
  .max(50, '密码长度必须在 6-50 之间')
  .refine(
    (value) => value.length === 0 || value.trim().length > 0,
    '密码不能为空'
  )
  .refine(
    (value) => value.length === 0 || value.length >= 6,
    '密码长度至少 6 位'
  );
