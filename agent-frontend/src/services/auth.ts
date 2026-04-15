import { z } from 'zod';
import {
  currentUserResponseSchema,
  jwtPayloadSchema,
  loginParamsSchema,
  loginResponseSchema,
  registerParamsSchema,
  storedCurrentUserSchema,
  storedUserInfoSchema,
  updateUserParamsSchema,
  userDtoSchema,
  type JwtPayload,
  type CurrentUserResponse,
  type LoginParams,
  type LoginResponse,
  type RegisterParams,
  type StoredCurrentUser,
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
const CURRENT_USER_KEY = 'currentUser';

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
  localStorage.removeItem(CURRENT_USER_KEY);
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
  persistLegacyUserInfo(userInfo);
  setStoredCurrentUser({
    userId: userInfo.userId,
    username: userInfo.username,
    role: userInfo.role,
    ...(userInfo.status
      ? {
          status: userInfo.status === 'ACTIVE' ? 1 : 0,
          statusText: userInfo.status === 'ACTIVE' ? '激活' : '禁用',
        }
      : {}),
  });
}

export function getUserInfo(): StoredUserInfo | null {
  const currentUser = getStoredCurrentUser();
  if (currentUser) {
    const normalizedStatus = normalizeUserStatus(currentUser.status, currentUser.statusText);
    const parsed = storedUserInfoSchema.safeParse({
      userId: currentUser.userId,
      username: currentUser.username,
      role: currentUser.role,
      status: normalizedStatus,
    });

    return parsed.success ? parsed.data : null;
  }

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

export function getStoredCurrentUser(): StoredCurrentUser | null {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (raw) {
    try {
      const parsed = storedCurrentUserSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        return parsed.data;
      }
    } catch {
      // ignore invalid cache
    }
  }

  const legacyUser = getLegacyUserInfo();
  if (!legacyUser) {
    return null;
  }

  const migrated = storedCurrentUserSchema.safeParse({
    userId: legacyUser.userId,
    username: legacyUser.username,
    role: legacyUser.role,
    ...(legacyUser.status
      ? {
          status: legacyUser.status === 'ACTIVE' ? 1 : 0,
          statusText: legacyUser.status === 'ACTIVE' ? '激活' : '禁用',
        }
      : {}),
  });

  if (!migrated.success) {
    return null;
  }

  setStoredCurrentUser(migrated.data);
  return migrated.data;
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
  if (statusText === '激活') {
    return 'ACTIVE';
  }
  if (statusText === '禁用') {
    return 'DISABLED';
  }
  return undefined;
}

export async function register(params: RegisterParams): Promise<ApiResponse<null>> {
  return api.post('/auth/register', params, z.null(), registerParamsSchema);
}

export async function login(
  params: LoginParams
): Promise<ApiResponse<LoginResponse>> {
  const previousUserId = getStoredCurrentUser()?.userId ?? getLegacyUserInfo()?.userId ?? null;
  const result = await api.post(
    '/auth/login',
    params,
    loginResponseSchema,
    loginParamsSchema
  );

  if (result.code === 200 && result.data) {
    if (previousUserId !== null && previousUserId !== result.data.userId) {
      clearPersistedChatState();
      localStorage.removeItem('agent_name');
    }

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
    setStoredCurrentUser(result.data);
    persistLegacyUserInfo({
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

function persistLegacyUserInfo(info: StoredUserInfo): void {
  localStorage.setItem(USER_ID_KEY, String(info.userId));
  localStorage.setItem(USERNAME_KEY, info.username);
  localStorage.setItem(USER_ROLE_KEY, info.role);

  if (info.status) {
    localStorage.setItem(USER_STATUS_KEY, info.status);
  } else {
    localStorage.removeItem(USER_STATUS_KEY);
  }
}

function getLegacyUserInfo(): StoredUserInfo | null {
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

function setStoredCurrentUser(user: StoredCurrentUser): void {
  const parsed = storedCurrentUserSchema.parse(user);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(parsed));
}
