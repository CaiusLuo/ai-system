// Admin API 服务

import { api, ApiResponse } from './api';
import {
  AdminUserDTO,
  UserListParams,
  UserListResponse,
  CreateUserParams,
  UpdateAdminUserParams,
} from '../types';

export type { AdminUserDTO as User, UserListParams, CreateUserParams, UpdateAdminUserParams as UpdateUserParams };

// API 基础路径
const API_BASE = '/api/admin';

// 获取用户列表
export async function getUserList(params: UserListParams): Promise<ApiResponse<UserListResponse>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.keyword ? { keyword: params.keyword } : {}),
    ...(params.role ? { role: params.role } : {}),
    ...(params.status ? { status: params.status } : {}),
  }).toString();

  return api.get(`${API_BASE}/users?${query}`);
}

// 创建用户
export async function createUser(data: CreateUserParams): Promise<ApiResponse<AdminUserDTO>> {
  return api.post(`${API_BASE}/users`, data);
}

// 更新用户
export async function updateUser(id: number, data: UpdateAdminUserParams): Promise<ApiResponse<AdminUserDTO>> {
  return api.put(`${API_BASE}/users/${id}`, data);
}

// 删除用户
export async function deleteUser(id: number): Promise<ApiResponse<null>> {
  return api.delete(`${API_BASE}/users/${id}`);
}

// 切换用户状态 (启用/禁用)
export async function toggleUserStatus(id: number): Promise<ApiResponse<AdminUserDTO>> {
  return api.patch(`${API_BASE}/users/${id}/toggle-status`);
}
