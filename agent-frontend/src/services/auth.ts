// 认证服务

import { api, ApiResponse } from './api';
import { LoginParams, RegisterParams, LoginResponse, UserDTO } from '../types';

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'userId';
const USERNAME_KEY = 'username';
const USER_ROLE_KEY = 'userRole';
const USER_STATUS_KEY = 'userStatus';

// Token 管理
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_STATUS_KEY);
}

// 用户信息管理
export function setUserInfo(info: { userId: number; username: string; role: 'ADMIN' | 'USER'; status?: string }): void {
  localStorage.setItem(USER_ID_KEY, String(info.userId));
  localStorage.setItem(USERNAME_KEY, info.username);
  localStorage.setItem(USER_ROLE_KEY, info.role);
  if (info.status) {
    localStorage.setItem(USER_STATUS_KEY, info.status);
  }
}

export function getUserInfo(): { userId: number; username: string; role: 'ADMIN' | 'USER'; status?: string } | null {
  const userId = localStorage.getItem(USER_ID_KEY);
  const username = localStorage.getItem(USERNAME_KEY);
  const role = localStorage.getItem(USER_ROLE_KEY);
  const status = localStorage.getItem(USER_STATUS_KEY);

  if (!userId || !username || !role) return null;

  return {
    userId: Number(userId),
    username,
    role: role as 'ADMIN' | 'USER',
    status: status || undefined,
  };
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  return getUserInfo()?.role === 'ADMIN';
}

export function isUserDisabled(): boolean {
  return getUserInfo()?.status === 'DISABLED';
}

// 用户注册
export async function register(params: RegisterParams): Promise<ApiResponse<null>> {
  return api.post('/auth/register', params);
}

// 用户登录
export async function login(params: LoginParams): Promise<ApiResponse<LoginResponse>> {
  const result = await api.post<LoginResponse>('/auth/login', params);

  // 登录成功后保存 token 和用户信息
  if (result.code === 200 && result.data) {
    setToken(result.data.token);
    setUserInfo({
      userId: result.data.userId,
      username: result.data.username,
      role: result.data.role,
    });
  }

  return result;
}

// 登出
export function logout(): void {
  removeToken();
}

// 获取用户信息
export async function getUserInfoById(id: number): Promise<ApiResponse<UserDTO>> {
  return api.get(`/user/${id}`);
}

// 更新用户信息
export async function updateUserInfo(id: number, data: { username?: string; email?: string; password?: string }): Promise<ApiResponse<null>> {
  return api.put(`/user/${id}`, data);
}
