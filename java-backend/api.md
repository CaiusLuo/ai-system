# API 接口文档

> 前端项目：agent-frontend  
> 后端端口：8080  
> 代理前缀：`/agent`（通过 Vite 代理转发到 `http://localhost:8080`）

---

## 1. 聊天接口（SSE 流式）

### 1.1 发送消息并接收流式响应

**端点:** `POST /agent/chat/stream`

**认证:** 需要 `Authorization: Bearer <token>`

**请求头:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "message": "用户消息内容",
  "conversationId": 123,
  "sessionId": "optional-session-id"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户消息内容 |
| conversationId | number | 否 | 会话 ID，首次请求不需要 |
| sessionId | string | 否 | 会话标识（Python Agent 使用） |

**响应:** Server-Sent Events (SSE) 流  
**Content-Type:** `text/event-stream`

---

### SSE 事件格式

所有 SSE 事件的 `data` 字段均为 **JSON 字符串**，前端需要 `JSON.parse()` 解析。

#### 标准化数据结构

后端已将 Python 返回的数据标准化为以下统一格式，前端可按此格式解析：

```typescript
// SSE 事件类型定义
export interface SSEChunkData {
  type: 'chunk' | 'done' | 'error' | 'ping';
  content: string;           // chunk 内容
  index: number;             // chunk 序号（从 0 开始）
  reasoning?: string;        // 思考过程内容（思考模式）
  info?: string;             // 额外信息（done 事件时的总结信息）
  conversationId?: number;   // 首次响应可能包含 conversationId
}
```

#### 事件类型详解

| 事件类型 | `data` 字段结构 | 说明 | 前端处理 |
|---------|----------------|------|---------|
| `chunk` | `{ "type": "chunk", "content": "内容", "index": 0, "reasoning": "思考过程"?, "conversationId": 123? }` | AI 回复的内容片段 | 打字机输出 `content`，若有 `reasoning` 显示思考过程 |
| `done`  | `{ "type": "done", "info": "总结信息", "conversationId": 123? }` | 流式传输完成 | 结束打字机，显示总结信息（若有） |
| `error` | `{ "type": "error", "message": "错误信息" }` | 发生错误 | 显示错误提示 |
| `ping`  | `{ "type": "ping" }` | 心跳检测（每 15 秒） | 可忽略，或用于检测连接状态 |

#### 完整 SSE 原始格式示例

```
event: chunk
id: chunk-0
data: {"type":"chunk","content":"你","index":0}

event: chunk
id: chunk-1
data: {"type":"chunk","content":"好","index":1}

event: chunk
id: chunk-2
data: {"type":"chunk","content":"！","index":2,"reasoning":"用户打招呼"}

event: done
id: done-3
data: {"type":"done","info":"对话完成","conversationId":123}
```

---

### 1.2 断线恢复

**端点:** `GET /agent/chat/stream/recover`

**说明:** 前端 SSE 断开后，从此接口重新获取未接收的 chunk。

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversationId | number | 是 | 会话 ID |
| messageId | string | 是 | 消息 UUID（首次请求时后端返回） |
| lastEventId | string | 否 | 最后接收到的事件 ID（如 `chunk-5`） |

**响应:** SSE 流，格式同 `1.1`

**使用方式:**
```
GET /agent/chat/stream/recover?conversationId=123&messageId=xxx&lastEventId=chunk-5
```

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
| 2 | GET | `/agent/chat/stream/recover` | SSE 断线恢复 | ✅ 已实现 |
| 3 | GET | `/api/admin/users` | 获取用户列表 | ⚠️ Mock |
| 4 | POST | `/api/admin/users` | 创建用户 | ⚠️ Mock |
| 5 | PUT | `/api/admin/users/{id}` | 更新用户 | ⚠️ Mock |
| 6 | DELETE | `/api/admin/users/{id}` | 删除用户 | ⚠️ Mock |
| 7 | PATCH | `/api/admin/users/{id}/toggle-status` | 切换用户状态 | ⚠️ Mock |

---

## 前端对接指南（React + TypeScript）

### 推荐方案：`fetch-event-source`

```typescript
import { fetchEventSource } from '@microsoft/fetch-event-source';

// SSEChunkData 类型定义
export interface SSEChunkData {
  type: 'chunk' | 'done' | 'error' | 'ping';
  content: string;
  index: number;
  reasoning?: string;
  info?: string;
  conversationId?: number;
}

// 使用示例
fetchEventSource('/agent/chat/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ message: '你好' }),
  onmessage(event) {
    const data: SSEChunkData = JSON.parse(event.data);
    
    switch (data.type) {
      case 'chunk':
        // 打字机输出 content
        setReply(prev => prev + data.content);
        // 如果有 reasoning，显示思考过程
        if (data.reasoning) {
          setReasoning(prev => prev + data.reasoning);
        }
        break;
      case 'done':
        // 流式完成
        console.log('完成，总结:', data.info);
        break;
      case 'error':
        // 错误处理
        console.error('错误:', data.message);
        break;
      case 'ping':
        // 心跳，可忽略
        break;
    }
  },
  onclose() {
    console.log('连接关闭');
  },
  onerror(error) {
    console.error('SSE 错误:', error);
  },
});
```

### 原生 `fetch` 方案（无需额外依赖）

```typescript
const response = await fetch('/agent/chat/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ message: '你好' }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  
  // 解析 SSE 格式
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data: SSEChunkData = JSON.parse(line.slice(6));
      // 处理 data...
    }
  }
}
```

---

## 注意事项

1. **代理配置**: 所有 `/agent` 开头的请求会通过 Vite 代理转发到 `http://localhost:8080`
2. **认证**: `/agent/chat/stream` 需要 `Authorization: Bearer <token>` 请求头
3. **SSE 格式**: 聊天接口使用 Server-Sent Events，`data` 字段为 JSON 字符串，需 `JSON.parse()` 解析
4. **错误处理**: 所有接口统一返回 `ApiResponse` 格式，SSE 接口除外
5. **数据标准化**: 无论 Python 服务返回什么格式，Java 后端都会标准化为上述 `SSEChunkData` 格式
6. **断线恢复**: 前端应监听 `onclose` 事件，断开后调用 `/recover` 接口恢复
