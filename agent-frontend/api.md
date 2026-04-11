# API 接口文档

> 前端项目：agent-frontend
> 后端端口：8080
> 代理配置：所有请求通过 Vite 代理转发到 `http://localhost:8080`

---

## 🔑 认证接口

### 1.1 登录

**端点:** `POST /auth/login`

**请求体:**
```json
{
  "username": "用户名",
  "password": "密码"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "JWT Token",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "ADMIN"
    }
  }
}
```

### 1.2 注册

**端点:** `POST /auth/register`

**请求体:**
```json
{
  "username": "用户名",
  "email": "user@example.com",
  "password": "密码（至少6位）"
}
```

**响应:** 同登录

### 1.3 获取当前用户信息

**端点:** `GET /user/info`

**请求头:** `Authorization: Bearer <token>`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

---

## 💬 聊天接口（SSE 流式）

### 2.1 发送消息并接收流式响应

**端点:** `POST /agent/chat/stream`

**请求头:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "message": "用户消息内容",
  "conversationId": 123  // 可选，首次请求不需要
}
```

**响应:** Server-Sent Events (SSE) 流

**SSE 事件格式:**

| 事件类型 | data 字段 | 说明 |
|---------|----------|------|
| `chunk` | `{ "type": "chunk", "content": "内容", "index": 0, "reasoning": "思考过程", "conversationId": 123, "messageId": "uuid" }` | AI 回复片段（首次可能包含 conversationId，任意时刻可能包含 messageId） |
| `done`  | `{ "type": "done", "total_tokens": 100, "conversationId": 123, "messageId": "uuid", "info": "完成信息" }` | 流式传输完成（**必须包含 messageId**） |
| `error` | `{ "type": "error", "message": "错误信息" }` | 发生错误 |
| `ping`  | `{ "type": "ping" }` | 心跳检测（可忽略） |

**⚠️ 重要说明:**
- `messageId` 是后端生成的消息唯一标识（UUID 格式）
- 优先从 `done` 事件中获取 `messageId`，备用从 `chunk` 事件中获取
- `conversationId` 在首次响应时返回，后续请求需携带此 ID

**错误码:**
- `401` - 认证失败
- `429` - 请求过于频繁

### 2.2 中断流式生成（Abort）

**端点:** `POST /agent/chat/stream/abort`

**请求头:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": true  // true = 成功中断，false = 任务已结束或不存在
}
```

---

## 📂 会话管理接口

### 3.1 获取会话列表

**端点:** `GET /conversation/list`

**请求头:** `Authorization: Bearer <token>`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "title": "会话标题",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 3.2 获取会话消息列表

**端点:** `GET /conversation/{id}/messages`

**请求头:** `Authorization: Bearer <token>`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": 1,
      "conversationId": 1,
      "userId": 1,
      "role": "user",
      "content": "消息内容",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 3.3 删除会话

**端点:** `DELETE /conversation/{id}`

**请求头:** `Authorization: Bearer <token>`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

---

## 👥 管理员接口（Admin API）

> 所有接口均需 `ADMIN` 角色权限

### 4.1 获取用户列表

**端点:** `GET /api/admin/users`

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页数量（默认 10，最大 100） |
| keyword | string | 否 | 搜索关键词 |
| role | string | 否 | `ADMIN` 或 `USER` |
| status | string | 否 | `ACTIVE` 或 `DISABLED` |

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "role": "ADMIN",
        "status": "ACTIVE",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

### 4.2 创建用户

**端点:** `POST /api/admin/users`

**请求体:**
```json
{
  "username": "新用户名",
  "email": "user@example.com",
  "password": "密码（至少6位）",
  "role": "USER",
  "status": "ACTIVE"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 13,
    "username": "新用户名",
    "email": "user@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2024-07-20T10:00:00Z"
  }
}
```

### 4.3 更新用户

**端点:** `PUT /api/admin/users/{id}`

**请求体:**
```json
{
  "username": "更新后的用户名",
  "email": "updated@example.com",
  "password": "新密码（可选，留空则不修改）",
  "role": "ADMIN",
  "status": "ACTIVE"
}
```

### 4.4 删除用户

**端点:** `DELETE /api/admin/users/{id}`

**说明:** 逻辑删除

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

### 4.5 切换用户状态

**端点:** `PATCH /api/admin/users/{id}/toggle-status`

**说明:** 在 `ACTIVE` 和 `DISABLED` 之间切换

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "username": "用户名",
    "email": "user@example.com",
    "role": "USER",
    "status": "DISABLED",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## 📊 数据模型

### User（用户）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | number | 用户 ID |
| username | string | 用户名 |
| email | string | 邮箱 |
| role | string | `ADMIN` 或 `USER` |
| status | string | `ACTIVE` 或 `DISABLED` |
| createdAt | string | ISO 8601 格式时间 |

### Conversation（会话）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | number | 会话 ID |
| userId | number | 用户 ID |
| title | string | 会话标题 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

### Message（消息）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | number | 消息 ID |
| conversationId | number | 所属会话 ID |
| userId | number | 用户 ID |
| role | string | `user` 或 `assistant` |
| content | string | 消息内容 |
| createdAt | string | 创建时间 |

### ApiResponse（通用响应包装）

```typescript
interface ApiResponse<T> {
  code: number;     // 200 表示成功
  message: string;  // 响应消息
  data: T;          // 响应数据
}
```

---

## 📝 接口汇总

| 序号 | 方法 | 端点 | 说明 | 状态 |
|-----|------|------|------|------|
| 1 | POST | `/auth/login` | 用户登录 | ✅ 已实现 |
| 2 | POST | `/auth/register` | 用户注册 | ✅ 已实现 |
| 3 | GET | `/user/info` | 获取当前用户信息 | ✅ 已实现 |
| 4 | POST | `/agent/chat/stream` | SSE 流式聊天 | ✅ 已实现 |
| 5 | POST | `/agent/chat/stream/abort` | 中断流式生成 | ✅ 已实现 |
| 6 | GET | `/conversation/list` | 获取会话列表 | ✅ 已实现 |
| 7 | GET | `/conversation/{id}/messages` | 获取会话消息 | ✅ 已实现 |
| 8 | DELETE | `/conversation/{id}` | 删除会话 | ✅ 已实现 |
| 9 | GET | `/api/admin/users` | 管理员：获取用户列表 | ✅ 已实现 |
| 10 | POST | `/api/admin/users` | 管理员：创建用户 | ✅ 已实现 |
| 11 | PUT | `/api/admin/users/{id}` | 管理员：更新用户 | ✅ 已实现 |
| 12 | DELETE | `/api/admin/users/{id}` | 管理员：删除用户 | ✅ 已实现 |
| 13 | PATCH | `/api/admin/users/{id}/toggle-status` | 管理员：切换用户状态 | ✅ 已实现 |

---

## ⚠️ 注意事项

1. **代理配置**: 所有 `/agent`, `/auth`, `/user`, `/conversation`, `/api` 开头的请求都会代理到 `http://localhost:8080`
2. **认证**: 大部分接口需要 `Authorization: Bearer <token>` 请求头
3. **SSE 格式**: 聊天接口使用 Server-Sent Events，数据格式为 `event: <type>\ndata: <JSON>`
4. **双重中断**: 中断流式生成需要同时调用前端 `abortController.abort()` 和后端 `/abort` 接口
5. **并发限制**: 后端限制同一用户最多 5 个并发流式请求
