# API 接口文档

> 前端项目：agent-frontend  
> 后端端口：8080  
> 代理前缀：`/agent`（通过 Vite 代理转发到 `http://localhost:8080`）

---

## 1. 聊天接口（SSE 流式）

### 1.1 发送消息并接收流式响应

**端点:** `POST /agent/chat/stream`

**请求头:**
```
Content-Type: application/json
```

**请求体:**
```json
{
  "message": "用户消息内容",
  "conversationId": 123  // 可选，首次请求不需要
}
```

**响应:** Server-Sent Events (SSE) 流

**SSE 事件类型:**

| 事件类型 | 数据结构 | 说明 |
|---------|---------|------|
| `chunk` | `{ "type": "chunk", "content": "内容", "index": 0, "conversationId": 123 }` | AI 回复的内容片段（首次可能包含 conversationId） |
| `done`  | `{ "type": "done", "total_tokens": 100 }` | 流式传输完成 |
| `error` | `{ "type": "error", "message": "错误信息" }` | 发生错误 |
| `ping`  | `{ "type": "ping" }` | 心跳检测（可忽略） |

**错误码:**
- `401` - 认证失败
- `429` - 请求过于频繁

---

## 2. 用户管理接口（Admin API）

> 注意：以下接口目前在前端使用 Mock 数据，后端需实现以下端点

### 2.1 获取用户列表

**端点:** `GET /api/admin/users`

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| page | number | 是 | 页码（从 1 开始） |
| pageSize | number | 是 | 每页数量 |
| keyword | string | 否 | 搜索关键词（匹配用户名或邮箱） |
| role | string | 否 | 角色筛选：`ADMIN` 或 `USER` |
| status | string | 否 | 状态筛选：`ACTIVE` 或 `DISABLED` |

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

---

### 2.2 创建用户

**端点:** `POST /api/admin/users`

**请求头:**
```
Content-Type: application/json
```

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

---

### 2.3 更新用户

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

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "username": "更新后的用户名",
    "email": "updated@example.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 2.4 删除用户

**端点:** `DELETE /api/admin/users/{id}`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

---

### 2.5 切换用户状态

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

## 数据模型

### User（用户）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | number | 用户 ID |
| username | string | 用户名 |
| email | string | 邮箱 |
| role | string | 角色：`ADMIN` 或 `USER` |
| status | string | 状态：`ACTIVE` 或 `DISABLED` |
| createdAt | string | 创建时间（ISO 8601 格式） |

### ApiResponse（通用响应包装）

| 字段 | 类型 | 说明 |
|-----|------|------|
| code | number | 响应状态码（200 表示成功） |
| message | string | 响应消息 |
| data | any | 响应数据 |

---

## 接口汇总清单

| 序号 | 方法 | 端点 | 说明 | 当前状态 |
|-----|------|------|------|---------|
| 1 | POST | `/agent/chat/stream` | SSE 流式聊天 | ✅ 已实现 |
| 2 | GET | `/api/admin/users` | 获取用户列表 | ⚠️ Mock |
| 3 | POST | `/api/admin/users` | 创建用户 | ⚠️ Mock |
| 4 | PUT | `/api/admin/users/{id}` | 更新用户 | ⚠️ Mock |
| 5 | DELETE | `/api/admin/users/{id}` | 删除用户 | ⚠️ Mock |
| 6 | PATCH | `/api/admin/users/{id}/toggle-status` | 切换用户状态 | ⚠️ Mock |

---

## 注意事项

1. **代理配置**: 所有 `/agent` 开头的请求会通过 Vite 代理转发到 `http://localhost:8080`
2. **认证**: 部分接口可能需要 `Authorization: Bearer <token>` 请求头（当前未启用）
3. **SSE 格式**: 聊天接口使用 Server-Sent Events，响应数据格式为 `data: {JSON}`
4. **错误处理**: 所有接口统一返回 `ApiResponse` 格式，通过 `code` 字段判断是否成功
