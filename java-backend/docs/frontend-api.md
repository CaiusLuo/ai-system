# 前端 API 对接文档

> **后端服务端口：** `8080`
> 
> **认证方式：** JWT Bearer Token
> 
> **统一响应格式：** `{ code: 200, message: "操作成功", data: {} }`

> **前端开发环境代理（Vite）说明：**
> - 前端本地开发时通过 Vite proxy 直接转发到 `http://localhost:8080`
> - 路由前缀与后端保持一致：`/agent`、`/auth`、`/user`、`/conversation`、`/api`
> - ⚠️ 注意：只有 **Agent 对话相关接口** 使用 `/agent` 前缀；会话/用户/认证等接口分别使用各自的根路径（例如 `/conversation/list` 而不是 `/agent/conversation/list`）

---

## 目录

- [1. 认证模块](#1-认证模块)
- [2. 流式对话模块](#2-流式对话模块)
- [3. 会话管理模块](#3-会话管理模块)
- [4. 用户模块](#4-用户模块)
- [5. 管理员模块](#5-管理员模块)
- [6. TypeScript 类型定义](#6-typescript-类型定义)
- [7. 完整示例代码](#7-完整示例代码)

---

## 1. 认证模块

### 1.1 用户注册

**接口路径：** `POST /auth/register`

**认证：** 不需要

**请求体：**
```typescript
interface RegisterRequest {
  username: string;   // 用户名（3-50字符，必填）
  email: string;      // 邮箱地址（必填）
  password: string;   // 密码（6-50字符，必填）
}
```

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "123456"
}
```

**响应：**
```typescript
interface Result<T> {
  code: number;       // 200=成功
  message: string;    // 提示信息
  data: T;           // 响应数据
}

// 注册响应
Result<null>
```

```json
{
  "code": 200,
  "message": "注册成功",
  "data": null
}
```

---

### 1.2 用户登录

**接口路径：** `POST /auth/login`

**认证：** 不需要

**请求体：**
```typescript
interface LoginRequest {
  username: string;   // 用户名（必填）
  password: string;   // 密码（必填）
}
```

```json
{
  "username": "testuser",
  "password": "123456"
}
```

**响应：**
```typescript
interface LoginResponse {
  token: string;      // JWT 认证令牌
  userId: number;     // 用户 ID
  username: string;   // 用户名
  role: string;       // 用户角色（USER/ADMIN）
  expiresAt: number;        // token 过期时间戳（毫秒）
  expiresInSeconds: number; // token 剩余秒数
}

Result<LoginResponse>
```

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "userId": 1,
    "username": "testuser",
    "role": "USER",
    "expiresAt": 1770000000000,
    "expiresInSeconds": 3600
  }
}
```

---

### 1.3 获取当前用户信息

**接口路径：** `GET /auth/me`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**响应：**
```typescript
interface CurrentUserResponse {
  userId: number;                 // 用户 ID
  username: string;               // 用户名
  role: string;                   // 用户角色
  status?: number;                // 状态（1=激活, 0=禁用）
  statusText?: 'ACTIVE' | 'DISABLED'; // 后端真实返回值
  expiresAt: number;              // token 过期时间戳（毫秒）
  expiresInSeconds: number;       // token 剩余秒数
  expired: boolean;               // token 是否已过期（当前接口固定返回 false）
}

Result<CurrentUserResponse>
```

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "userId": 1,
    "username": "testuser",
    "role": "USER",
    "status": 1,
    "statusText": "ACTIVE",
    "expiresAt": 1770000000000,
    "expiresInSeconds": 3600,
    "expired": false
  }
}
```

---

## 2. 流式对话模块

### 2.1 发起流式对话

**接口路径：** `POST /agent/chat/stream`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**Content-Type：** `application/json`

**响应类型：** `text/event-stream` (SSE)

**请求体：**
```typescript
interface StreamChatRequest {
  message: string;         // 用户消息（必填）
  conversationId?: number; // 会话 ID（可选，不传则自动创建）
  sessionId?: string;      // 会话标识（可选）
}
```

```json
{
  "message": "你好，请帮我优化简历",
  "conversationId": 123,
  "sessionId": "optional-session-id"
}
```

**响应：** Server-Sent Events (SSE) 流

#### SSE 事件格式

所有事件的 `data` 字段均为 **JSON 字符串**，需要 `JSON.parse()` 解析。

> **v2 协议（2026-04-12）**：事件统一使用 camelCase 字段；新增 `start` 事件。
> `chunk` / `done` / `error` 事件会携带 `messageId`、`requestId`、`userId`、`conversationId`
> 等链路字段，前端应按 `event` 名称和 `data.type` 共同处理。

##### Message ID 事件（⭐ 首个事件）

```
event: message_id
data: {"messageId":"550e8400-e29b-41d4-a716-446655440000"}
```

```typescript
interface SSEMessageIdData {
  messageId: string;   // ⭐ 消息唯一标识（用于中断操作）
}
```

**重要说明：**
- ⭐ 这是 SSE 连接的**首个事件**
- 前端应**立即保存** `messageId`
- 在流式生成**进行中**可以使用此 ID 调用 abort 接口

##### Start 事件（v2 新增）

```
event: start
data: {"type":"start","requestId":"req-1712908800000-550e8400","userId":1,"conversationId":123,"messageId":"550e8400-e29b-41d4-a716-446655440000","timestamp":1712908800000}
```

```typescript
interface SSEStartData {
  type: 'start';
  messageId: string;
  requestId: string;
  userId: number;
  conversationId: number;
  timestamp?: number;
}
```

##### Chunk 事件（流式内容）

```
event: chunk
id: chunk-550e8400-e29b-41d4-a716-446655440000
data: {"type":"chunk","messageId":"550e8400-e29b-41d4-a716-446655440000","requestId":"req-1712908800000-550e8400","userId":1,"conversationId":123,"content":"内容片段","index":0}
```

```typescript
interface SSEChunkData {
  type: 'chunk';
  messageId?: string;
  requestId?: string;
  userId?: number;
  conversationId?: number;
  content: string;      // 当前生成的内容
  index: number;        // chunk 序号（从0开始）
  reasoning?: string;   // 可选：AI 思考过程
  info?: string;        // 可选：附加信息
}
```

##### Done 事件（生成完成）⭐

```
event: done
id: done-550e8400-e29b-41d4-a716-446655440000
data: {"type":"done","messageId":"550e8400-e29b-41d4-a716-446655440000","requestId":"req-1712908800000-550e8400","userId":1,"conversationId":123,"contentLength":2,"chunkCount":2,"info":"对话完成","timestamp":1712908805000}
```

```typescript
interface SSEDoneData {
  type: 'done';
  info: string;              // 完成总结/标题
  conversationId: number;    // 对话ID
  messageId: string;         // ⭐ 重要：消息唯一标识（用于中断操作）
  requestId?: string;
  userId?: number;
  contentLength?: number;    // v2 完整性校验字段
  chunkCount?: number;       // v2 完整性校验字段
  timestamp?: number;
}
```

##### Error 事件（发生错误）

```
event: error
data: {"type":"error","message":"错误信息"}
```

```typescript
interface SSEErrorData {
  type: 'error';
  message: string;   // 错误描述
  messageId?: string;
  requestId?: string;
  userId?: number;
  errorCode?: string;
  timestamp?: number;
}
```

##### Ping 事件（心跳）

```
event: ping
data: {"type":"ping"}
```

```typescript
interface SSEPingData {
  type: 'ping';
}
```

**说明：** 心跳事件，每 **30 秒** 发送一次，用于保持连接活跃。前端可以忽略此事件。

---

### 2.2 非流式对话

**接口路径：** `POST /agent/chat`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**请求体：**
```typescript
interface ChatRequest {
  message: string;         // 用户消息（必填）
  conversationId?: number; // 会话 ID（可选）
}
```

```json
{
  "message": "你好",
  "conversationId": 123
}
```

**响应：**
```typescript
interface ChatResponse {
  reply: string;           // AI 回复内容
  conversationId: number;  // 会话 ID
}

Result<ChatResponse>
```

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "reply": "AI 回复内容",
    "conversationId": 123
  }
}
```

---

### 2.3 中断流式生成（推荐）

**接口路径：** `POST /agent/chat/stream/abort`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**请求体：**
```typescript
interface AbortRequest {
  messageId: string;   // 消息 ID（UUID，SSE 首个 message_id 事件返回；done 事件也会回传用于确认）
}
```

```json
{
  "messageId": "0bb96056-a78d-4d4b-9f73-e373a2c7b5e3"
}
```

**响应：**
```typescript
Result<boolean>   // true=成功中断，false=任务已结束
```

```json
{
  "code": 200,
  "message": "操作成功",
  "data": true
}
```

---

### 2.4 中断流式生成（RESTful）

**接口路径：** `POST /agent/api/v1/chat/{conversationId}/abort`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**路径参数：**
```typescript
{
  conversationId: number;   // 会话 ID
}
```

**响应：**
```typescript
Result<boolean>
```

---

### 2.5 断线恢复

**接口路径：** `GET /agent/chat/stream/recover`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**查询参数：**
```typescript
{
  conversationId: number;   // 会话 ID（必填）
  messageId: string;        // 消息 ID（必填）
  lastEventId?: string;     // 最后接收到的事件 ID（可选）
}
```

**示例：**
```
GET /agent/chat/stream/recover?conversationId=123&messageId=0bb96056-a78d-4d4b-9f73-e373a2c7b5e3&lastEventId=chunk-10
```

**响应：** Server-Sent Events (SSE) 流（replay 历史 chunk）

---

## 3. 会话管理模块

### 3.1 获取会话列表

**接口路径：** `GET /conversation/list`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**响应：**
```typescript
interface ConversationDTO {
  id: number;                // 会话 ID
  userId: number;            // 用户 ID
  title: string;             // 会话标题
  lastMessageContent: string; // 最新消息内容（预览）
  lastMessageTime: string;   // 最新消息时间 (ISO 8601)
  createdAt: string;         // 创建时间 (ISO 8601)
  updatedAt: string;         // 更新时间 (ISO 8601)
}

Result<ConversationDTO[]>
```

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "title": "求职助手",
      "lastMessageContent": "你好！我是你的求职助手...",
      "lastMessageTime": "2026-04-10T12:00:00",
      "createdAt": "2026-04-10T10:00:00",
      "updatedAt": "2026-04-10T12:00:00"
    }
  ]
}
```

---

### 3.2 获取消息列表

**接口路径：** `GET /conversation/{id}/messages`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**路径参数：**
```typescript
{
  id: number;   // 会话 ID
}
```

**响应：**
```typescript
interface MessageDTO {
  id: number;              // 消息 ID
  conversationId: number;  // 会话 ID
  userId: number;          // 用户 ID
  username: string;        // 用户名
  role: string;            // 消息角色（user/assistant）
  content: string;         // 消息内容
  title: string;           // 消息标题
  createdAt: string;       // 创建时间 (ISO 8601)
  updatedAt: string;       // 更新时间 (ISO 8601)
}

Result<MessageDTO[]>
```

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "conversationId": 1,
      "userId": 1,
      "username": "testuser",
      "role": "user",
      "content": "你好",
      "title": null,
      "createdAt": "2026-04-10T10:00:00",
      "updatedAt": "2026-04-10T10:00:00"
    }
  ]
}
```

---

### 3.3 删除会话

**接口路径：** `DELETE /conversation/{id}`

**认证：** 需要 `Authorization: Bearer <TOKEN>`

**路径参数：**
```typescript
{
  id: number;   // 会话 ID
}
```

**响应：**
```typescript
Result<null>
```

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

**说明：** 逻辑删除会话和关联消息（软删除）

**错误码补充说明：**

| code | 场景 | message |
|------|------|---------|
| 403 | 会话存在但不属于当前用户 | 无权访问该会话 |
| 404 | 会话不存在，或已被逻辑删除（重复删除也会命中） | 会话不存在或已删除 |

---

## 4. 用户模块

### 4.1 获取用户信息

**接口路径：** `GET /user/{id}`

**路径参数：**
```typescript
{
  id: number;   // 用户 ID
}
```

**响应：**
```typescript
interface UserDTO {
  id: number;          // 用户 ID
  username: string;    // 用户名
  email: string;       // 邮箱地址
  role: string;        // 用户角色（USER/ADMIN）
  status: number;      // 状态（1=激活, 0=禁用）
  statusText: 'ACTIVE' | 'DISABLED';  // 后端真实返回值
}

Result<UserDTO>
```

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "role": "USER",
    "status": 1,
    "statusText": "ACTIVE"
  }
}
```

---

### 4.2 更新用户信息

**接口路径：** `PUT /user/{id}`

**路径参数：**
```typescript
{
  id: number;   // 用户 ID
}
```

**请求体：**（所有字段可选）
```typescript
interface UserUpdateRequest {
  username?: string;   // 用户名
  email?: string;      // 邮箱地址
  role?: string;       // 用户角色
  status?: string;     // 用户状态
}
```

```json
{
  "username": "updatedUsername",
  "email": "updated@example.com"
}
```

**响应：**
```typescript
Result<string>   // "更新成功"
```

---

## 5. 管理员模块

所有接口均需 **ADMIN 角色**权限。

### 5.1 获取用户列表

**接口路径：** `GET /api/admin/users`

**认证：** 需要 `Authorization: Bearer <TOKEN>` + ADMIN 角色

**查询参数：**
```typescript
interface UserListRequest {
  page?: number;         // 页码（默认 1）
  pageSize?: number;     // 每页数量（默认 10，最大 100）
  keyword?: string;      // 搜索关键词（匹配用户名或邮箱）
  role?: string;         // 角色筛选（ADMIN/USER）
  status?: string;       // 状态筛选（ACTIVE/DISABLED）
}
```

**示例：**
```
GET /api/admin/users?page=1&pageSize=10&keyword=admin&role=USER&status=ACTIVE
```

**响应：**
```typescript
interface AdminUserDTO {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface UserListResponse {
  list: AdminUserDTO[];
  total: number;
  page: number;
  pageSize: number;
}

Result<UserListResponse>
```

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "role": "ADMIN",
        "status": "ACTIVE",
        "createdAt": "2026-04-10T10:00:00"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 5.2 创建用户

**接口路径：** `POST /api/admin/users`

**认证：** 需要 `Authorization: Bearer <TOKEN>` + ADMIN 角色

**请求体：**
```typescript
interface UserCreateRequest {
  username: string;   // 用户名（3-50字符，必填）
  email: string;      // 邮箱地址（必填）
  password: string;   // 密码（至少6位，必填）
  role: string;       // 角色（ADMIN/USER，必填）
  status: string;     // 状态（ACTIVE/DISABLED，必填）
}
```

```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "role": "USER",
  "status": "ACTIVE"
}
```

**响应：**
```typescript
Result<AdminUserDTO>
```

---

### 5.3 更新用户

**接口路径：** `PUT /api/admin/users/{id}`

**认证：** 需要 `Authorization: Bearer <TOKEN>` + ADMIN 角色

**路径参数：**
```typescript
{
  id: number;   // 用户 ID
}
```

**请求体：**（所有字段可选）
```typescript
interface UserUpdateRequest {
  username?: string;   // 用户名（3-50字符）
  email?: string;      // 邮箱地址
  password?: string;   // 新密码（至少6位，留空则不修改）
  role?: string;       // 角色
  status?: string;     // 状态
}
```

**响应：**
```typescript
Result<AdminUserDTO>
```

---

### 5.4 删除用户

**接口路径：** `DELETE /api/admin/users/{id}`

**认证：** 需要 `Authorization: Bearer <TOKEN>` + ADMIN 角色

**路径参数：**
```typescript
{
  id: number;   // 用户 ID
}
```

**响应：**
```typescript
Result<null>
```

**说明：** 逻辑删除用户（软删除）

---

### 5.5 切换用户状态

**接口路径：** `PATCH /api/admin/users/{id}/toggle-status`

**认证：** 需要 `Authorization: Bearer <TOKEN>` + ADMIN 角色

**路径参数：**
```typescript
{
  id: number;   // 用户 ID
}
```

**响应：**
```typescript
Result<AdminUserDTO>
```

**说明：** 在 `ACTIVE` 和 `DISABLED` 之间切换

---

## 6. TypeScript 类型定义

### 完整类型定义文件

```typescript
// ==================== 通用类型 ====================

interface Result<T> {
  code: number;
  message: string;
  data: T;
}

// ==================== 认证模块 ====================

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  role: string;
  expiresAt: number;
  expiresInSeconds: number;
}

interface CurrentUserResponse {
  userId: number;
  username: string;
  role: string;
  status?: number;
  statusText?: 'ACTIVE' | 'DISABLED';
  expiresAt: number;
  expiresInSeconds: number;
  expired: boolean;
}

// ==================== 流式对话模块 ====================

interface StreamChatRequest {
  message: string;
  conversationId?: number;
  sessionId?: string;
}

interface ChatRequest {
  message: string;
  conversationId?: number;
}

interface ChatResponse {
  reply: string;
  conversationId: number;
}

interface AbortRequest {
  messageId: string;
}

// SSE 事件数据类型
interface SSEMessageIdData {
  messageId: string;
}

interface SSEStartData {
  type: 'start';
  messageId: string;
  requestId: string;
  userId: number;
  conversationId: number;
  timestamp?: number;
}

interface SSEChunkData {
  type: 'chunk';
  messageId?: string;
  requestId?: string;
  userId?: number;
  conversationId?: number;
  content: string;
  index: number;
  reasoning?: string;
  info?: string;
}

interface SSEDoneData {
  type: 'done';
  info: string;
  conversationId: number;
  messageId: string;
  requestId?: string;
  userId?: number;
  contentLength?: number;
  chunkCount?: number;
  timestamp?: number;
}

interface SSEErrorData {
  type: 'error';
  message: string;
  messageId?: string;
  requestId?: string;
  userId?: number;
  errorCode?: string;
  timestamp?: number;
}

interface SSEPingData {
  type: 'ping';
}

// ==================== 会话管理模块 ====================

interface ConversationDTO {
  id: number;
  userId: number;
  title: string;
  lastMessageContent: string;
  lastMessageTime: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageDTO {
  id: number;
  conversationId: number;
  userId: number;
  username: string;
  role: string;
  content: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== 用户模块 ====================

interface UserDTO {
  id: number;
  username: string;
  email: string;
  role: string;
  status: number;
  statusText: 'ACTIVE' | 'DISABLED';
}

interface UserUpdateRequest {
  username?: string;
  email?: string;
  role?: string;
  status?: string;
}

// ==================== 管理员模块 ====================

interface UserListRequest {
  page?: number;
  pageSize?: number;
  keyword?: string;
  role?: string;
  status?: string;
}

interface AdminUserDTO {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface UserListResponse {
  list: AdminUserDTO[];
  total: number;
  page: number;
  pageSize: number;
}

interface UserCreateRequest {
  username: string;
  email: string;
  password: string;
  role: string;
  status: string;
}
```

---

## 7. 完整示例代码

### 7.1 API 客户端封装

```typescript
// api/client.ts

// ⚠️ 注意：
// - 只有 Agent 对话相关接口使用 /agent 前缀
// - /auth /user /conversation /api 为后端根路径（由 Vite proxy 直接转发到 8080）
const AGENT_BASE_URL = '/agent';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private getHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: Result<T> = await response.json();

    if (result.code !== 200) {
      throw new Error(result.message || '请求失败');
    }

    return result.data;
  }

  // ==================== 认证接口 ====================

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    const result = await this.handleResponse<LoginResponse>(response);

    // 保存 token
    localStorage.setItem('token', result.token);
    localStorage.setItem('userId', String(result.userId));

    return result;
  }

  async register(data: RegisterRequest): Promise<string> {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    // 后端返回：{ code:200, message:"注册成功", data:null }
    return this.handleResponse<null>(response) as unknown as string;
  }

  async getCurrentUser(): Promise<CurrentUserResponse> {
    const response = await fetch('/auth/me', {
      headers: this.getHeaders(),
    });

    return this.handleResponse<CurrentUserResponse>(response);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  }

  // ==================== 流式对话接口 ====================

  async streamChat(data: StreamChatRequest): Promise<EventSource> {
    // 注意：SSE 需要使用 fetch + ReadableStream 或者 EventSource
    // 这里使用 EventSource 的封装（需要额外处理 POST）
    return new Promise((resolve, reject) => {
      // 实现细节见下方的 StreamChatClient 类
    });
  }

  async abortStream(messageId: string): Promise<boolean> {
    const response = await fetch(`${AGENT_BASE_URL}/chat/stream/abort`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ messageId }),
    });

    return this.handleResponse<boolean>(response);
  }

  async nonStreamChat(data: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${AGENT_BASE_URL}/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ChatResponse>(response);
  }

  // ==================== 会话管理接口 ====================

  async getConversations(): Promise<ConversationDTO[]> {
    const response = await fetch(`/conversation/list`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<ConversationDTO[]>(response);
  }

  async getMessages(conversationId: number): Promise<MessageDTO[]> {
    const response = await fetch(
      `/conversation/${conversationId}/messages`,
      {
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<MessageDTO[]>(response);
  }

  async deleteConversation(conversationId: number): Promise<null> {
    const response = await fetch(
      `/conversation/${conversationId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    // 后端返回：{ code:200, message:"删除成功", data:null }
    return this.handleResponse<null>(response);
  }

  // ==================== 用户接口 ====================

  async getUser(userId: number): Promise<UserDTO> {
    const response = await fetch(`/user/${userId}`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<UserDTO>(response);
  }

  async updateUser(
    userId: number,
    data: UserUpdateRequest
  ): Promise<string> {
    const response = await fetch(`/user/${userId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<string>(response);
  }

  // ==================== 管理员接口 ====================

  async getUserList(
    params: UserListRequest
  ): Promise<UserListResponse> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.set('page', String(params.page));
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params.keyword) queryParams.set('keyword', params.keyword);
    if (params.role) queryParams.set('role', params.role);
    if (params.status) queryParams.set('status', params.status);

    const response = await fetch(
      `/api/admin/users?${queryParams.toString()}`,
      {
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<UserListResponse>(response);
  }

  async createUser(data: UserCreateRequest): Promise<AdminUserDTO> {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<AdminUserDTO>(response);
  }

  async updateUserByAdmin(
    userId: number,
    data: UserUpdateRequest
  ): Promise<AdminUserDTO> {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<AdminUserDTO>(response);
  }

  async deleteUser(userId: number): Promise<void> {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<void>(response);
  }

  async toggleUserStatus(userId: number): Promise<AdminUserDTO> {
    const response = await fetch(
      `/api/admin/users/${userId}/toggle-status`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<AdminUserDTO>(response);
  }
}

export const apiClient = new ApiClient();
```

---

### 7.2 流式对话客户端

```typescript
// api/stream.ts

class StreamChatClient {
  private abortController: AbortController | null = null;
  private messageId: string | null = null;
  private currentContent = '';

  async streamChat(
    message: string,
    options?: {
      conversationId?: number;
      onMessageId?: (messageId: string) => void;  // ⭐ 新增
      onChunk?: (content: string) => void;
      onDone?: (info: string) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const token = localStorage.getItem('token');

    const response = await fetch('/agent/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        conversationId: options?.conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();

            if (eventType && eventData) {
              this.handleSseEvent(eventType, eventData, options);
              eventType = '';
              eventData = '';
            }
          }
        }
      }
    } catch (error) {
      console.error('流式读取失败:', error);
      options?.onError?.('网络错误');
    }
  }

  private handleSseEvent(
    eventType: string,
    eventData: string,
    options?: any
  ): void {
    try {
      const data = JSON.parse(eventData);

      switch (eventType) {
        case 'message_id':
          // ⭐ 首个事件，保存 messageId
          this.messageId = data.messageId;
          console.debug('获取 messageId:', data.messageId);
          break;

        case 'start':
          console.debug('流式开始:', data);
          break;

        case 'chunk':
          this.currentContent += data.content || '';
          options?.onChunk?.(this.currentContent);
          break;

        case 'done':
          // done 事件中也包含 messageId（用于确认）
          if (data.messageId) {
            console.log('流式完成，确认 messageId:', data.messageId);
          }
          options?.onDone?.(data.info);
          break;

        case 'error':
          options?.onError?.(data.message);
          break;

        case 'ping':
          // 心跳事件，可以忽略或用于检测连接状态
          console.debug('心跳');
          break;

        default:
          console.warn('未知事件类型:', eventType, data);
      }
    } catch (error) {
      console.error('解析 SSE 数据失败:', error);
    }
  }

  // 中断流式生成
  async abort(): Promise<boolean> {
    if (!this.messageId) {
      console.warn('没有活跃的流式任务');
      return false;
    }

    const token = localStorage.getItem('token');

    const response = await fetch('/agent/chat/stream/abort', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messageId: this.messageId }),
    });

    const result = await response.json();
    return result.data;
  }

  // 获取当前 messageId
  getMessageId(): string | null {
    return this.messageId;
  }
}

export const streamChatClient = new StreamChatClient();
```

---

### 7.3 React Hooks 示例

```typescript
// hooks/useStreamChat.ts

import { useState, useCallback, useRef } from 'react';

export function useStreamChat() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageIdRef = useRef<string | null>(null);  // ⭐ 使用 ref 保存 messageId

  const streamChat = useCallback(
    async (message: string, conversationId?: number) => {
      setLoading(true);
      setError(null);
      setContent('');
      messageIdRef.current = null;  // 重置 messageId

      try {
        await streamChatClient.streamChat(message, {
          conversationId,
          onMessageId: (id) => {
            // ⭐ 立即保存 messageId（首个事件）
            messageIdRef.current = id;
            console.log('获取 messageId:', id);
          },
          onChunk: (newContent) => {
            setContent(newContent);
          },
          onDone: (info) => {
            console.log('完成:', info);
          },
          onError: (errorMsg) => {
            setError(errorMsg);
          },
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const abort = useCallback(async () => {
    if (!messageIdRef.current) {
      console.warn('尚未获取 messageId，无法中断');
      return false;
    }
    
    const success = await streamChatClient.abort();
    if (success) {
      setLoading(false);
    }
    return success;
  }, []);

  return {
    content,
    loading,
    error,
    messageId: messageIdRef.current,
    streamChat,
    abort,
  };
}
```

---

## 8. 重要注意事项

### 8.1 认证

- 所有需要认证的接口都必须在请求头中包含 `Authorization: Bearer <TOKEN>`
- Token 通过登录接口获取
- Token 过期时会返回 `401 Unauthorized`

### 8.2 超时时间

| 配置项 | 值 | 说明 |
|--------|-----|------|
| SSE 空闲超时 | 600 秒（10分钟） | 连接空闲超时 |
| 任务超时 | 30 分钟 | 从开始到完成的总时间 |
| 心跳间隔 | 30 秒 | 自动发送 ping 事件 |
| Redis TTL | 3600 秒 | chunk 数据过期时间 |

### 8.3 错误码

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token 无效或过期） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 8.4 messageId 的重要性

- `messageId` 是从 `done` 事件中获取的唯一标识
- 用于后续的 **中断操作**
- 必须在流完成后才能获取
- 每个流式请求对应一个唯一的 `messageId`

### 8.5 Abort 清理机制

中断流式生成时，后端会自动清理：
- ✅ Redis 中的临时 chunk 数据
- ✅ 用户消息记录
- ✅ 如果是新建的空会话，会自动删除

---

## 9. 常见问题

### Q1: 如何处理 SSE 断线？

使用断线恢复接口，传入 `lastEventId` 可以继续接收未完成的流。

### Q2: 为什么需要心跳机制？

防止中间件（Nginx、负载均衡器）因空闲断开连接。前端可以忽略 ping 事件。

### Q3: 如何区分用户消息和 AI 消息？

通过 `MessageDTO` 中的 `role` 字段：
- `user`：用户消息
- `assistant`：AI 消息

---

**文档版本：** v2.0  
**最后更新：** 2026-04-12
