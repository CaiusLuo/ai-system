// 认证服务

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  role: 'ADMIN' | 'USER';
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: number;
}

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'userId';
const USERNAME_KEY = 'username';
const USER_ROLE_KEY = 'userRole';

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
}

// 用户信息管理
export function setUserInfo(info: { userId: number; username: string; role: 'ADMIN' | 'USER' }): void {
  localStorage.setItem(USER_ID_KEY, String(info.userId));
  localStorage.setItem(USERNAME_KEY, info.username);
  localStorage.setItem(USER_ROLE_KEY, info.role);
}

export function getUserInfo(): { userId: number; username: string; role: 'ADMIN' | 'USER' } | null {
  const userId = localStorage.getItem(USER_ID_KEY);
  const username = localStorage.getItem(USERNAME_KEY);
  const role = localStorage.getItem(USER_ROLE_KEY);
  
  if (!userId || !username || !role) return null;
  
  return {
    userId: Number(userId),
    username,
    role: role as 'ADMIN' | 'USER',
  };
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  return getUserInfo()?.role === 'ADMIN';
}

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

// 用户注册
export async function register(params: RegisterParams): Promise<ApiResponse<null>> {
  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  return response.json();
}

// 用户登录
export async function login(params: LoginParams): Promise<ApiResponse<LoginResponse>> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  const result: ApiResponse<LoginResponse> = await response.json();

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
export async function getUserInfoById(id: number): Promise<ApiResponse<UserInfo>> {
  return request(`/user/${id}`);
}

// 更新用户信息
export async function updateUserInfo(id: number, data: { email?: string }): Promise<ApiResponse<null>> {
  return request(`/user/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
