# API 接口文档

> 后端端口：`8080`  
> 代理前缀：`/agent`（通过 Vite 代理转发到 `http://localhost:8080`）

> **前端对接文档：** [docs/frontend-api.md](docs/frontend-api.md) - 包含 TypeScript 类型定义和完整示例
---

## 接口汇总

| 序号 | 方法 | 端点 | 说明 |
|-----|------|------|------|
| 1 | POST | `/auth/register` | 用户注册 |
| 2 | POST | `/auth/login` | 用户登录 |
| 3 | POST | `/agent/chat/stream` | SSE 流式对话 |
| 4 | POST | `/agent/chat/stream/abort` | 中断流式生成 |
| 5 | POST | `/api/v1/chat/{conversationId}/abort` | 中断流式生成（RESTful） |
| 6 | GET | `/agent/chat/stream/recover` | SSE 断线恢复 |
| 7 | GET | `/conversation/list` | 获取会话列表 |
| 8 | GET | `/conversation/{id}/messages` | 获取消息列表 |
| 9 | DELETE | `/conversation/{id}` | 删除会话 |
| 10 | GET | `/api/admin/users` | 管理员：获取用户列表 |
| 11 | POST | `/api/admin/users` | 管理员：创建用户 |
| 12 | PUT | `/api/admin/users/{id}` | 管理员：更新用户 |
| 13 | DELETE | `/api/admin/users/{id}` | 管理员：删除用户 |
| 14 | PATCH | `/api/admin/users/{id}/toggle-status` | 管理员：切换用户状态 |

---

## 1. 认证接口

### 1.1 用户注册

**POST** `/auth/register`

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "123456"
}
```

### 1.2 用户登录

**POST** `/auth/login`

```json
{
  "username": "testuser",
  "password": "123456"
}
```

**响应：**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "userId": 1,
    "username": "testuser",
    "role": "USER"
  }
}
```

---

## 2. SSE 流式对话

### 2.1 发起流式对话

**POST** `/agent/chat/stream`

**认证：** 需要 `Authorization: Bearer <token>`

**请求体：**
```json
{
  "message": "你好",
  "conversationId": 123,
  "sessionId": "optional-session-id"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户消息 |
| conversationId | number | 否 | 会话 ID（首次可选，不传则自动创建） |
| sessionId | string | 否 | 会话标识 |

**响应：** Server-Sent Events (SSE) 流

### SSE 事件格式

所有事件的 `data` 字段均为 **JSON 字符串**，需 `JSON.parse()` 解析。

```typescript
interface SSEChunkData {
  type: 'chunk' | 'done' | 'error' | 'ping';
  content: string;
  index: number;
  reasoning?: string;
  info?: string;
  conversationId?: number;
  messageId?: string;  // ⭐ done 事件中返回
}
```

| 事件类型 | data 结构 | 说明 | 前端处理 |
|---------|-----------|------|---------|
| `chunk` | `{ type, content, index, reasoning? }` | AI 回复片段 | 打字机输出 |
| `done`  | `{ type, info, conversationId, messageId }` | 完成 ⭐含 messageId | 保存 messageId |
| `error` | `{ type, message }` | 错误 | 显示错误 |
| `ping`  | `{ type }` | 心跳（15s） | 忽略 |

**完整示例：**
```
event: chunk
id: chunk-0
data: {"type":"chunk","content":"你","index":0}

event: done
id: done-1
data: {"type":"done","info":"对话完成","conversationId":123,"messageId":"550e8400-e29b-41d4-a716-446655440000"}
```

---

### 2.2 中断流式生成

**POST** `/agent/chat/stream/abort`

**请求体：**
```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| data | boolean | `true`=成功中断，`false`=任务已结束 |

**Abort 清理机制：**
- ✅ 自动删除 Redis 中的临时数据
- ✅ 自动删除用户消息记录
- ✅ 如果是**新建会话**（未传入 conversationId），自动删除空会话
- ✅ 如果是**已有会话**，保留会话和之前的消息

---

### 2.3 中断流式生成（RESTful）

**POST** `/api/v1/chat/{conversationId}/abort`

通过 conversationId 中断该会话下最新的活跃流。

**清理机制：** 同 2.2

---

### 2.4 断线恢复

**GET** `/agent/chat/stream/recover?conversationId=123&messageId=xxx&lastEventId=chunk-5`

---

### 前端对接示例

```typescript
let currentMessageId = null;

// 1. 发起流式对话
fetchEventSource('/agent/chat/stream', {
  method: 'POST',
  body: JSON.stringify({ message: '你好' }),
  onmessage(event) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'done' && data.messageId) {
      currentMessageId = data.messageId; // ⭐ 保存
    }
  },
});

// 2. 用户点击"停止"时调用
async function abortGeneration() {
  if (!currentMessageId) return;
  
  await fetch('/agent/chat/stream/abort', {
    method: 'POST',
    body: JSON.stringify({ messageId: currentMessageId }),
  });
}
```

**详细对接文档：** 参见 `docs/SSE_ABORT_GUIDE.md`

---

## 3. 会话管理

### 3.1 获取会话列表

**GET** `/conversation/list`

**认证：** 需要 Token

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "title": "会话标题",
      "lastMessageContent": "最新消息内容",
      "lastMessageTime": "2026-04-10T12:00:00",
      "createdAt": "2026-04-10T10:00:00",
      "updatedAt": "2026-04-10T12:00:00"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 会话 ID |
| userId | number | 用户 ID |
| title | string | 会话标题 |
| lastMessageContent | string | 最新消息内容（预览） |
| lastMessageTime | string | 最新消息时间 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

### 3.2 获取消息列表

**GET** `/conversation/{id}/messages`

**认证：** 需要 Token

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "conversationId": 1,
      "userId": 1,
      "username": "用户名",
      "role": "user",
      "content": "消息内容",
      "title": "消息标题",
      "createdAt": "2026-04-10T10:00:00",
      "updatedAt": "2026-04-10T10:00:00"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 消息 ID |
| conversationId | number | 会话 ID |
| userId | number | 用户 ID |
| username | string | 用户名 |
| role | string | 角色（user/assistant） |
| content | string | 消息内容 |
| title | string | 消息标题 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

### 3.3 删除会话

**DELETE** `/conversation/{id}`

**认证：** 需要 Token

**说明：** 逻辑删除会话和关联消息

---

## 4. 管理员接口

所有接口均需 `ADMIN` 角色权限。

### 4.1 获取用户列表

**GET** `/api/admin/users?page=1&pageSize=10&keyword=admin&role=USER&status=ACTIVE`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页数量（默认 10，最大 100） |
| keyword | string | 否 | 搜索关键词 |
| role | string | 否 | `ADMIN` 或 `USER` |
| status | string | 否 | `ACTIVE` 或 `DISABLED` |

### 4.2 创建用户

**POST** `/api/admin/users`

```json
{
  "username": "新用户名",
  "email": "user@example.com",
  "password": "密码（至少6位）",
  "role": "USER",
  "status": "ACTIVE"
}
```

### 4.3 更新用户

**PUT** `/api/admin/users/{id}`

```json
{
  "username": "更新后的用户名",
  "email": "updated@example.com",
  "password": "新密码（可选）",
  "role": "ADMIN",
  "status": "ACTIVE"
}
```

### 4.4 删除用户

**DELETE** `/api/admin/users/{id}`

逻辑删除。

### 4.5 切换用户状态

**PATCH** `/api/admin/users/{id}/toggle-status`

在 `ACTIVE` 和 `DISABLED` 之间切换。

---

## 配置说明

### application-dev.yml

```yaml
streaming:
  max-concurrent: 1000          # 最大并发流（全局）
  per-user-limit: 5             # 单用户最大流数
  max-chunks-per-message: 5000  # 单条消息最大 chunk
  chunk-ttl: 3600               # Redis chunk TTL（秒）

python-agent:
  url: http://localhost:5001
  stream-endpoint: /api/v1/chat/stream
```

### Abort 机制

1. **messageId 获取**：后端在 `done` 事件中返回
2. **自动清理**：任务完成/中断/超时后自动清理 abortMap
3. **线程安全**：`ConcurrentHashMap` + `AtomicBoolean`

---

## 统一响应格式

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 200=成功，其他=失败 |
| message | string | 提示信息 |
| data | any | 响应数据 |
