import { z } from 'zod';
import {
  currentUserResponseSchema,
  jwtPayloadSchema,
  loginParamsSchema,
  loginResponseSchema,
  registerParamsSchema,
  storedUserInfoSchema,
  updateUserParamsSchema,
  userDtoSchema,
  type JwtPayload,
  type CurrentUserResponse,
  type LoginParams,
  type LoginResponse,
  type RegisterParams,
  type StoredUserInfo,
  type UpdateUserParams,
  type UserDTO,
} from '../schemas';
import { clearPersistedChatState } from './chatStorage';
import { api, type ApiResponse } from './api';

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'userId';
const USERNAME_KEY = 'username';
const USER_ROLE_KEY = 'userRole';
const USER_STATUS_KEY = 'userStatus';

export const AUTH_PAGE_PATH = '/login';

export type AuthStatus = 'valid' | 'missing' | 'expired' | 'invalid';

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
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) {
    return null;
  }

  try {
    const payload = JSON.parse(decoded);
    const result = jwtPayloadSchema.safeParse(payload);
    return result.success ? result.data : null;
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

export function getLoginRoute(
  reason: 'session-expired' | 'unauthorized' = 'unauthorized'
): string {
  return reason === 'session-expired'
    ? `${AUTH_PAGE_PATH}?reason=session-expired`
    : AUTH_PAGE_PATH;
}

export function redirectToLogin(
  reason: 'session-expired' | 'unauthorized' = 'unauthorized'
): void {
  removeToken();

  const target = getLoginRoute(reason);
  const current = `${window.location.pathname}${window.location.search}`;

  if (current !== target) {
    window.location.assign(target);
  }
}

export function setUserInfo(info: StoredUserInfo): void {
  const userInfo = storedUserInfoSchema.parse(info);
  localStorage.setItem(USER_ID_KEY, String(userInfo.userId));
  localStorage.setItem(USERNAME_KEY, userInfo.username);
  localStorage.setItem(USER_ROLE_KEY, userInfo.role);

  if (userInfo.status) {
    localStorage.setItem(USER_STATUS_KEY, userInfo.status);
  } else {
    localStorage.removeItem(USER_STATUS_KEY);
  }
}

export function getUserInfo(): StoredUserInfo | null {
  const userId = localStorage.getItem(USER_ID_KEY);
  const username = localStorage.getItem(USERNAME_KEY);
  const role = localStorage.getItem(USER_ROLE_KEY);
  const status = localStorage.getItem(USER_STATUS_KEY);

  if (!userId || !username || !role) {
    return null;
  }

  const parsed = storedUserInfoSchema.safeParse({
    userId: Number(userId),
    username,
    role,
    status: status || undefined,
  });

  return parsed.success ? parsed.data : null;
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

function normalizeUserStatus(
  status?: number,
  statusText?: string
): StoredUserInfo['status'] {
  if (status === 1) {
    return 'ACTIVE';
  }
  if (status === 0) {
    return 'DISABLED';
  }
  if (statusText === 'ACTIVE' || statusText === 'DISABLED') {
    return statusText;
  }
  return undefined;
}

export async function register(params: RegisterParams): Promise<ApiResponse<null>> {
  return api.post('/auth/register', params, z.null(), registerParamsSchema);
}

export async function login(
  params: LoginParams
): Promise<ApiResponse<LoginResponse>> {
  const result = await api.post(
    '/auth/login',
    params,
    loginResponseSchema,
    loginParamsSchema
  );

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

export function logout(): void {
  removeToken();
  localStorage.removeItem('agent_name');
}

export async function getUserInfoById(id: number): Promise<ApiResponse<UserDTO>> {
  return api.get(`/user/${id}`, userDtoSchema);
}

export async function getCurrentUser(): Promise<ApiResponse<CurrentUserResponse>> {
  const result = await api.get('/auth/me', currentUserResponseSchema);

  if (result.code === 200 && result.data) {
    setUserInfo({
      userId: result.data.userId,
      username: result.data.username,
      role: result.data.role,
      status: normalizeUserStatus(result.data.status, result.data.statusText),
    });
  }

  return result;
}

export async function updateUserInfo(
  id: number,
  data: UpdateUserParams
): Promise<ApiResponse<null>> {
  const result = await api.put(`/user/${id}`, data, z.null(), updateUserParamsSchema);

  if (result.code === 200) {
    const current = getUserInfo();
    if (current?.userId === id) {
      await getCurrentUser();
    }
  }

  return result;
}
