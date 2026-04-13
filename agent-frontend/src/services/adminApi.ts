import { z } from 'zod';
import {
  adminUserDtoSchema,
  createUserParamsSchema,
  updateAdminUserParamsSchema,
  userListParamsSchema,
  userListResponseSchema,
  type AdminUserDTO,
  type CreateUserParams,
  type UpdateAdminUserParams,
  type UserListParams,
  type UserListResponse,
} from '../schemas';
import { api, type ApiResponse } from './api';

export type {
  AdminUserDTO as User,
  CreateUserParams,
  UpdateAdminUserParams as UpdateUserParams,
  UserListParams,
};

const API_BASE = '/api/admin/users';

export async function getUserList(
  params: UserListParams
): Promise<ApiResponse<UserListResponse>> {
  const validatedParams = userListParamsSchema.parse(params);
  const query = new URLSearchParams({
    page: String(validatedParams.page),
    pageSize: String(validatedParams.pageSize),
    ...(validatedParams.keyword ? { keyword: validatedParams.keyword } : {}),
    ...(validatedParams.role ? { role: validatedParams.role } : {}),
    ...(validatedParams.status ? { status: validatedParams.status } : {}),
  }).toString();

  return api.get(`${API_BASE}?${query}`, userListResponseSchema);
}

export async function createUser(
  data: CreateUserParams
): Promise<ApiResponse<AdminUserDTO>> {
  return api.post(
    API_BASE,
    data,
    adminUserDtoSchema,
    createUserParamsSchema
  );
}

export async function updateUser(
  id: number,
  data: UpdateAdminUserParams
): Promise<ApiResponse<AdminUserDTO>> {
  return api.put(
    `${API_BASE}/${id}`,
    data,
    adminUserDtoSchema,
    updateAdminUserParamsSchema
  );
}

export async function deleteUser(id: number): Promise<ApiResponse<null>> {
  return api.delete(`${API_BASE}/${id}`, z.null());
}

export async function toggleUserStatus(
  id: number
): Promise<ApiResponse<AdminUserDTO>> {
  return api.patch(`${API_BASE}/${id}/toggle-status`, undefined, adminUserDtoSchema);
}
