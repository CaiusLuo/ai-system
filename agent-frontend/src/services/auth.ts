// 认证服务

import { api, ApiResponse } from './api';
import { LoginParams, RegisterParams, LoginResponse, UserDTO } from '../types';
import { clearPersistedChatState } from './chatStorage';

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'userId';
const USERNAME_KEY = 'username';
const USER_ROLE_KEY = 'userRole';
const USER_STATUS_KEY = 'userStatus';
export const AUTH_PAGE_PATH = '/login';

export type AuthStatus = 'valid' | 'missing' | 'expired' | 'invalid';

interface JwtPayload {
  exp?: number;
}

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
  clearPersistedChatState();
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function getTokenPayload(token: string | null = getToken()): JwtPayload | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenExpiresAt(token: string | null = getToken()): number | null {
  const payload = getTokenPayload(token);
  if (!payload?.exp) {
    return null;
  }
  return payload.exp * 1000;
}

export function getAuthStatus(): AuthStatus {
  const token = getToken();
  if (!token) {
    return 'missing';
  }

  const expiresAt = getTokenExpiresAt(token);
  if (!expiresAt) {
    removeToken();
    return 'invalid';
  }

  if (expiresAt <= Date.now()) {
    removeToken();
    return 'expired';
  }

  return 'valid';
}

export function getLoginRoute(reason: 'session-expired' | 'unauthorized' = 'unauthorized'): string {
  return reason === 'session-expired'
    ? `${AUTH_PAGE_PATH}?reason=session-expired`
    : AUTH_PAGE_PATH;
}

export function redirectToLogin(reason: 'session-expired' | 'unauthorized' = 'unauthorized'): void {
  removeToken();

  const target = getLoginRoute(reason);
  const current = `${window.location.pathname}${window.location.search}`;

  if (current !== target) {
    window.location.assign(target);
  }
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
  return getAuthStatus() === 'valid';
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
  // 清理业务状态
  localStorage.removeItem('agent_name');
}

// 获取用户信息
export async function getUserInfoById(id: number): Promise<ApiResponse<UserDTO>> {
  return api.get(`/user/${id}`);
}

// 更新用户信息
export async function updateUserInfo(id: number, data: { username?: string; email?: string; password?: string }): Promise<ApiResponse<null>> {
  return api.put(`/user/${id}`, data);
}
