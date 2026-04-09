// Admin API 服务

import { getToken } from './auth';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export interface UserListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  role?: 'ADMIN' | 'USER';
  status?: 'ACTIVE' | 'DISABLED';
}

export interface UserListResponse {
  list: User[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateUserParams {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
}

export interface UpdateUserParams {
  username: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
}

// API 基础路径
const API_BASE = '/api/admin';

// 通用请求方法
async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  return response.json();
}

// 获取用户列表
export async function getUserList(params: UserListParams): Promise<ApiResponse<UserListResponse>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.keyword ? { keyword: params.keyword } : {}),
    ...(params.role ? { role: params.role } : {}),
    ...(params.status ? { status: params.status } : {}),
  }).toString();
  
  return request(`${API_BASE}/users?${query}`);
}

// 创建用户
export async function createUser(data: CreateUserParams): Promise<ApiResponse<User>> {
  return request(`${API_BASE}/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 更新用户
export async function updateUser(id: number, data: UpdateUserParams): Promise<ApiResponse<User>> {
  return request(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 删除用户
export async function deleteUser(id: number): Promise<ApiResponse<null>> {
  return request(`${API_BASE}/users/${id}`, {
    method: 'DELETE',
  });
}

// 切换用户状态 (启用/禁用)
export async function toggleUserStatus(id: number): Promise<ApiResponse<User>> {
  return request(`${API_BASE}/users/${id}/toggle-status`, {
    method: 'PATCH',
  });
}
