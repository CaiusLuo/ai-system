# API 接口文档

> **后端端口：** `8080`
> 
> **代理前缀：** `/agent`（通过 Vite 代理转发到 `http://localhost:8080`）
> 
> **前端对接文档：** [docs/frontend-api.md](docs/frontend-api.md) - 包含 TypeScript 类型定义和完整示例
> 
> **Agent API 文档：** [docs/agent-api.md](docs/agent-api.md) - Python Agent 流式网关协议

---

## 接口汇总

### 认证模块

| 序号 | 方法 | 端点 | 说明 | 认证 |
|-----|------|------|------|------|
| 1 | POST | `/auth/register` | 用户注册 | ❌ |
| 2 | POST | `/auth/login` | 用户登录 | ❌ |
| 3 | GET | `/auth/me` | 获取当前用户信息 | ✅ |

### 流式对话模块

| 序号 | 方法 | 端点 | 说明 | 认证 |
|-----|------|------|------|------|
| 4 | POST | `/agent/chat/stream` | SSE 流式对话 | ✅ |
| 5 | POST | `/agent/chat` | 非流式对话 | ✅ |
| 6 | POST | `/agent/chat/stream/abort` | 中断流式生成（推荐） | ✅ |
| 7 | POST | `/agent/api/v1/chat/{conversationId}/abort` | 中断流式生成（RESTful） | ✅ |
| 8 | GET | `/agent/chat/stream/recover` | SSE 断线恢复 | ✅ |

### 会话管理模块

| 序号 | 方法 | 端点 | 说明 | 认证 |
|-----|------|------|------|------|
| 9 | GET | `/conversation/list` | 获取会话列表 | ✅ |
| 10 | GET | `/conversation/{id}/messages` | 获取消息列表 | ✅ |
| 11 | DELETE | `/conversation/{id}` | 删除会话 | ✅ |

### 用户模块

| 序号 | 方法 | 端点 | 说明 | 认证 |
|-----|------|------|------|------|
| 12 | GET | `/user/{id}` | 获取用户信息 | ✅ |
| 13 | PUT | `/user/{id}` | 更新用户信息 | ✅ |

### 管理员模块

| 序号 | 方法 | 端点 | 说明 | 认证 |
|-----|------|------|------|------|
| 14 | GET | `/api/admin/users` | 获取用户列表 | ✅ ADMIN |
| 15 | POST | `/api/admin/users` | 创建用户 | ✅ ADMIN |
| 16 | PUT | `/api/admin/users/{id}` | 更新用户 | ✅ ADMIN |
| 17 | DELETE | `/api/admin/users/{id}` | 删除用户 | ✅ ADMIN |
| 18 | PATCH | `/api/admin/users/{id}/toggle-status` | 切换用户状态 | ✅ ADMIN |

---

## 1. 认证接口

### 1.1 用户注册

**POST** `/auth/register`

**请求体：**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|---------|------|
| username | string | ✅ | @NotBlank, @Size(3-50) | 用户名（3-50字符） |
| email | string | ✅ | @NotBlank, @Email | 邮箱地址 |
| password | string | ✅ | @NotBlank, @Size(6-50) | 密码（6-50字符） |

**响应：**
```json
{
  "code": 200,
  "message": "注册成功",
  "data": "注册成功"
}
```

---

### 1.2 用户登录

**POST** `/auth/login`

**请求体：**
```json
{
  "username": "testuser",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|---------|------|
| username | string | ✅ | @NotBlank | 用户名 |
| password | string | ✅ | @NotBlank | 密码 |

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

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | JWT 认证令牌 |
| userId | number | 用户 ID |
| username | string | 用户名 |
| role | string | 用户角色（USER/ADMIN） |

---

### 1.3 获取当前用户信息

**GET** `/auth/me`

**请求头：**
```
Authorization: Bearer <TOKEN>
```

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "userId": 1,
    "username": "testuser",
    "role": "USER",
    "status": 1,
    "statusText": "激活"
  }
}
```

---

## 2. SSE 流式对话

### 2.1 发起流式对话

**POST** `/agent/chat/stream`

**认证：** 需要 `Authorization: Bearer <token>`

**Content-Type：** `application/json`

**响应类型：** `text/event-stream` (SSE)

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
| message | string | ✅ | 用户消息（@NotBlank） |
| conversationId | number | ❌ | 会话 ID（首次可选，不传则自动创建） |
| sessionId | string | ❌ | 会话标识 |

**响应：** Server-Sent Events (SSE) 流

### SSE 事件格式

所有事件的 `data` 字段均为 **JSON 字符串**，需 `JSON.parse()` 解析。

> **v2 协议（2026-04-12）**：Python Agent 端已升级，所有事件统一使用 camelCase 命名，
> 每个事件必带 `messageId`、`userId`、`requestId`。新增 `start` 事件。

```typescript
interface SSEChunkData {
  type: 'start' | 'chunk' | 'done' | 'error' | 'ping' | 'message_id';
  // ⭐ v2 全链路追踪字段（每个事件必带）
  messageId: string;
  requestId: string;
  userId: number;
  conversationId: number;
  // 事件特有字段
  content?: string;
  index?: number;
  reasoning?: string;
  info?: string;
  contentLength?: number;    // v2 done 事件
  chunkCount?: number;       // v2 done 事件
  errorCode?: string;        // v2 error 事件
  timestamp?: number;        // v2 start/done/error 事件
}
```

| 事件类型 | data 结构 | 说明 | 前端处理 |
|---------|-----------|------|---------|
| `message_id` | `{ messageId: "UUID" }` | ⭐ **消息ID（首个事件，Java 端发送）** | **立即保存，用于 abort** |
| `start`  | `{ type, messageId, requestId, userId, conversationId, timestamp }` | v2 新增：Python 确认流式开始 | 日志记录 |
| `chunk` | `{ type, messageId, content, index, reasoning? }` | AI 回复片段 | 打字机输出 |
| `done`  | `{ type, messageId, info, contentLength, chunkCount, timestamp }` | 完成 | 完整性校验 |
| `error` | `{ type, messageId, message, errorCode }` | 错误 | 区分 ABORTED（正常）vs STREAM_ERROR（异常） |
| `ping`  | `{ type }` | 心跳（30s） | 忽略 |

**完整示例（v2）：**
```
event: message_id
data: {"messageId":"550e8400-e29b-41d4-a716-446655440000"}

event: start
data: {"type":"start","requestId":"req-1712908800000-550e8400","userId":1,"conversationId":123,"messageId":"550e8400-e29b-41d4-a716-446655440000","timestamp":1712908800000}

event: chunk
id: chunk-550e8400-e29b-41d4-a716-446655440000
data: {"type":"chunk","messageId":"550e8400-e29b-41d4-a716-446655440000","requestId":"req-1712908800000-550e8400","userId":1,"conversationId":123,"content":"你","index":0}

event: chunk
id: chunk-550e8400-e29b-41d4-a716-446655440000
data: {"type":"chunk","messageId":"550e8400-e29b-41d4-a716-446655440000","requestId":"req-1712908800000-550e8400","userId":1,"conversationId":123,"content","好","index":1}

event: done
id: done-550e8400-e29b-41d4-a716-446655440000
data: {"type":"done","messageId":"550e8400-e29b-41d4-a716-446655440000","requestId":"req-1712908800000-550e8400","userId":1,"conversationId":123,"contentLength":2,"chunkCount":2,"info":"对话完成","timestamp":1712908805000}
```

**重要说明：**
- ⭐ `message_id` 是**首个事件**，前端应立即保存 `messageId`
- 在流式生成**进行中**，前端可以使用 `messageId` 调用 abort 接口
- `done` 事件中也会包含 `messageId`（用于确认和记录）

**超时配置：**
- SSE 空闲超时：600 秒（10 分钟）
- 任务总超时：30 分钟
- 心跳间隔：30 秒

---

### 2.2 非流式对话

**POST** `/agent/chat`

**认证：** 需要 `Authorization: Bearer <token>`

**请求体：**
```json
{
  "message": "你好",
  "conversationId": 123
}
```

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|---------|------|
| message | string | ✅ | @NotBlank | 用户消息 |
| conversationId | number | ❌ | - | 会话 ID |

**响应：**
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

**POST** `/agent/chat/stream/abort`

**认证：** 需要 `Authorization: Bearer <token>`

**请求体：**
```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| messageId | string | ✅ | 消息 ID（UUID，从 done 事件中获取） |

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

### 2.4 中断流式生成（RESTful）

**POST** `/agent/api/v1/chat/{conversationId}/abort`

**认证：** 需要 `Authorization: Bearer <token>`

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversationId | number | ✅ | 会话 ID |

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": true
}
```

**说明：** 中断该 conversation 下最新的活跃流，清理机制同 2.3。

---

### 2.5 断线恢复

**GET** `/agent/chat/stream/recover?conversationId=123&messageId=xxx&lastEventId=chunk-5`

**认证：** 需要 `Authorization: Bearer <token>`

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversationId | number | ✅ | 会话 ID |
| messageId | string | ✅ | 消息 ID（UUID） |
| lastEventId | string | ❌ | 最后接收到的事件 ID |

**响应：** Server-Sent Events (SSE) 流（ replay 历史 chunk）

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

    // ⭐ 立即保存 messageId（首个事件）
    if (event.event === 'message_id' && data.messageId) {
      currentMessageId = data.messageId;
      return;
    }

    if (data.type === 'done' && data.messageId) {
      // done 事件中也包含 messageId（用于确认）
      console.log('流式完成，messageId:', data.messageId);
    }
  },
});

// 2. 用户点击"停止"时调用（在流式进行中）
async function abortGeneration() {
  if (!currentMessageId) {
    console.warn('尚未获取 messageId');
    return;
  }

  await fetch('/agent/chat/stream/abort', {
    method: 'POST',
    body: JSON.stringify({ messageId: currentMessageId }),
  });
}
```

**详细对接文档：** 参见 [docs/frontend-api.md](docs/frontend-api.md)

---

## 3. 会话管理

### 3.1 获取会话列表

**GET** `/conversation/list`

**认证：** 需要 `Authorization: Bearer <token>`

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

**ConversationDTO 数据结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 会话 ID |
| userId | number | 用户 ID |
| title | string | 会话标题 |
| lastMessageContent | string | 最新消息内容（预览） |
| lastMessageTime | string | 最新消息时间 (LocalDateTime) |
| createdAt | string | 创建时间 (LocalDateTime) |
| updatedAt | string | 更新时间 (LocalDateTime) |

---

### 3.2 获取消息列表

**GET** `/conversation/{id}/messages`

**认证：** 需要 `Authorization: Bearer <token>`

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 会话 ID |

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

**MessageDTO 数据结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 消息 ID |
| conversationId | number | 会话 ID |
| userId | number | 用户 ID |
| username | string | 用户名 |
| role | string | 消息角色（user/assistant） |
| content | string | 消息内容 |
| title | string | 消息标题 |
| createdAt | string | 创建时间 (LocalDateTime) |
| updatedAt | string | 更新时间 (LocalDateTime) |

---

### 3.3 删除会话

**DELETE** `/conversation/{id}`

**认证：** 需要 `Authorization: Bearer <token>`

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 会话 ID |

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": "删除成功"
}
```

**说明：** 逻辑删除会话和关联消息（软删除）

---

## 4. 用户模块

### 4.1 获取用户信息

**GET** `/user/{id}`

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 用户 ID |

**响应：**
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
    "statusText": "激活"
  }
}
```

**UserDTO 数据结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 用户 ID |
| username | string | 用户名 |
| email | string | 邮箱地址 |
| role | string | 用户角色（USER/ADMIN） |
| status | number | 状态（1=激活, 0=禁用） |
| statusText | string | 状态文本（"激活"/"禁用"） |

---

### 4.2 更新用户信息

**PUT** `/user/{id}`

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 用户 ID |

**请求体：**
```json
{
  "username": "updatedUsername",
  "email": "updated@example.com",
  "role": "USER",
  "status": "ACTIVE"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | ❌ | 用户名 |
| email | string | ❌ | 邮箱地址 |
| role | string | ❌ | 用户角色 |
| status | string | ❌ | 用户状态 |

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": "更新成功"
}
```

---

## 5. 管理员接口

所有接口均需 `ADMIN` 角色权限。

### 5.1 获取用户列表

**GET** `/api/admin/users?page=1&pageSize=10&keyword=admin&role=USER&status=ACTIVE`

**认证：** 需要 `Authorization: Bearer <token>` + ADMIN 角色

**查询参数：**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | ❌ | 1 | 页码（从 1 开始） |
| pageSize | number | ❌ | 10 | 每页数量（最大 100） |
| keyword | string | ❌ | - | 搜索关键词（匹配用户名或邮箱） |
| role | string | ❌ | - | 角色筛选（ADMIN/USER） |
| status | string | ❌ | - | 状态筛选（ACTIVE/DISABLED） |

**响应：**
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

**UserListResponse 数据结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| list | Array<UserDTO> | 用户列表 |
| total | number | 总记录数 |
| page | number | 当前页码 |
| pageSize | number | 每页数量 |

**UserDTO（管理员列表）数据结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 用户 ID |
| username | string | 用户名 |
| email | string | 邮箱地址 |
| role | string | 用户角色 |
| status | string | 用户状态 |
| createdAt | string | 创建时间 |

---

### 5.2 创建用户

**POST** `/api/admin/users`

**认证：** 需要 `Authorization: Bearer <token>` + ADMIN 角色

**请求体：**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "role": "USER",
  "status": "ACTIVE"
}
```

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|---------|------|
| username | string | ✅ | @NotBlank, @Size(3-50) | 用户名（3-50字符） |
| email | string | ✅ | @NotBlank, @Email | 邮箱地址 |
| password | string | ✅ | @NotBlank, @Size(6-50) | 密码（至少6位） |
| role | string | ✅ | @NotBlank | 角色（ADMIN/USER） |
| status | string | ✅ | @NotBlank | 状态（ACTIVE/DISABLED） |

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 2,
    "username": "newuser",
    "email": "user@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2026-04-10T10:00:00"
  }
}
```

---

### 5.3 更新用户

**PUT** `/api/admin/users/{id}`

**认证：** 需要 `Authorization: Bearer <token>` + ADMIN 角色

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 用户 ID |

**请求体：**
```json
{
  "username": "updateduser",
  "email": "updated@example.com",
  "password": "newpassword123",
  "role": "ADMIN",
  "status": "ACTIVE"
}
```

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|---------|------|
| username | string | ❌ | @Size(3-50) | 用户名（3-50字符） |
| email | string | ❌ | @Email | 邮箱地址 |
| password | string | ❌ | @Size(6-50) | 新密码（至少6位，留空则不修改） |
| role | string | ❌ | - | 角色（ADMIN/USER） |
| status | string | ❌ | - | 状态（ACTIVE/DISABLED） |

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 2,
    "username": "updateduser",
    "email": "updated@example.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2026-04-10T10:00:00"
  }
}
```

---

### 5.4 删除用户

**DELETE** `/api/admin/users/{id}`

**认证：** 需要 `Authorization: Bearer <token>` + ADMIN 角色

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 用户 ID |

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": null
}
```

**说明：** 逻辑删除用户（软删除）

---

### 5.5 切换用户状态

**PATCH** `/api/admin/users/{id}/toggle-status`

**认证：** 需要 `Authorization: Bearer <token>` + ADMIN 角色

**路径参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 用户 ID |

**响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 2,
    "username": "testuser",
    "email": "test@example.com",
    "role": "USER",
    "status": "DISABLED",
    "createdAt": "2026-04-10T10:00:00"
  }
}
```

**说明：** 在 `ACTIVE` 和 `DISABLED` 之间切换

---

## 配置说明

### application-dev.yml

```yaml
streaming:
  max-concurrent: 1000          # 最大并发流（全局）
  per-user-limit: 5             # 单用户最大流数
  max-chunks-per-message: 5000  # 单条消息最大 chunk
  chunk-ttl: 3600               # Redis chunk TTL（秒）
  task-timeout: 30              # 任务超时（分钟）

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

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token 无效或过期） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
