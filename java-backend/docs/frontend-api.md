# 前端 API 对接文档

> **后端地址**: `http://localhost:8080`
> **代理前缀**: `/agent`（通过 Vite 代理转发）
> **更新时间**: 2026-04-10
> **文档版本**: v3.0 - Message & Conversation 数据结构对齐

---

## ⚠️ 重要变更说明

### Message & Conversation 数据结构对齐（2026-04-10）

本次更新基于后端实际代码，确保前端 TypeScript 类型定义与后端 DTO **完全一致**：

1. ✅ **会话列表** (`GET /conversation/list`) - `ConversationDTO` 结构确认
2. ✅ **消息列表** (`GET /conversation/{id}/messages`) - `MessageDTO` 结构确认
3. ✅ **SSE 流式对话** - `messageId` 和 `conversationId` 获取方式确认
4. ✅ **Abort 机制** - 清理逻辑确认

**前端必须使用下方提供的 TypeScript 类型定义，确保数据结构一致。**

---

## 统一响应格式

所有接口均返回以下格式：

```typescript
interface ApiResponse<T> {
  code: number;      // 200 = 成功，其他 = 失败
  message: string;   // 提示信息
  data: T;           // 响应数据
}
```

---

## 1. 认证接口

### 1.1 用户登录

**POST** `/auth/login`

**请求体：**
```typescript
{
  username: string;
  password: string;
}
```

**响应：**
```typescript
{
  code: 200,
  message: "登录成功",
  data: {
    token: string;          // JWT Token
    userId: number;         // 用户 ID
    username: string;       // 用户名
    role: string;           // 角色：ADMIN | USER
  }
}
```

**前端处理：**
```typescript
// 保存 Token 到 localStorage
localStorage.setItem('token', response.data.token);
localStorage.setItem('userId', response.data.userId.toString());
```

---

## 2. 用户接口

### 2.1 获取用户信息

**GET** `/user/{id}`

**⚠️ 变更说明：** 
- 返回数据结构已更改，现在使用 `UserDTO` 格式
- **不再包含** `password` 字段
- 新增 `statusText` 字段

**响应：**
```typescript
{
  code: 200,
  data: {
    id: number;             // 用户 ID
    username: string;       // 用户名
    email: string;          // 邮箱
    role: string;           // 角色：ADMIN | USER
    status: number;         // 状态：1 = 启用，0 = 禁用
    statusText: string;     // 状态文本："ACTIVE" | "DISABLED"
  }
}
```

**前端使用示例：**
```typescript
interface UserDTO {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: number;
  statusText: 'ACTIVE' | 'DISABLED';
}

const response = await fetch('/user/1', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const user: UserDTO = response.data;

// 显示用户状态
const isActive = user.status === 1; // 或 user.statusText === 'ACTIVE'
```

### 2.2 更新用户信息

**PUT** `/user/{id}`

**请求体（所有字段可选）：**
```typescript
{
  username?: string;
  email?: string;
  password?: string;         // 如果提供，会自动加密
}
```

**响应：**
```typescript
{
  code: 200,
  message: "更新成功",
  data: null
}
```

---

## 3. 会话管理接口

### 3.1 获取会话列表

**GET** `/conversation/list`

**认证**: 需要 Token（通过 `Authorization: Bearer <token>` 传递）

**后端 DTO 定义**: `ConversationDTO.java`

```java
// 后端 ConversationDTO 字段（确认版）
@Data
public class ConversationDTO {
    private Long id;                    // 会话ID
    private Long userId;                // 用户ID
    private String title;               // 会话标题
    private String lastMessageContent;  // 最新消息内容（预览，可为 null）
    private LocalDateTime lastMessageTime;  // 最新消息时间（可为 null）
    private LocalDateTime createdAt;    // 创建时间
    private LocalDateTime updatedAt;    // 更新时间
}
```

**响应格式**:
```typescript
{
  code: 200,
  message: "操作成功",
  data: [
    {
      id: number;                // 会话 ID
      userId: number;            // 用户 ID
      title: string;             // 会话标题
      lastMessageContent: string | null;  // ⭐ 最新消息内容（可为 null）
      lastMessageTime: string | null;     // ⭐ 最新消息时间（ISO 8601 格式）
      createdAt: string;         // 创建时间（ISO 8601 格式）
      updatedAt: string;         // 更新时间（ISO 8601 格式）
    }
  ]
}
```

**TypeScript 类型定义：**
```typescript
interface ConversationDTO {
  id: number;
  userId: number;
  title: string;
  lastMessageContent: string | null;
  lastMessageTime: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**前端使用示例：**
```tsx
// 会话列表组件
function ConversationList({ conversations }: { conversations: ConversationDTO[] }) {
  return (
    <ul>
      {conversations.map(conv => (
        <li key={conv.id}>
          <h3>{conv.title}</h3>
          {/* 显示最新消息预览 */}
          {conv.lastMessageContent && (
            <p className="last-message">
              {conv.lastMessageContent.substring(0, 50)}...
            </p>
          )}
          <time>
            {conv.lastMessageTime 
              ? new Date(conv.lastMessageTime).toLocaleString()
              : '暂无消息'
            }
          </time>
        </li>
      ))}
    </ul>
  );
}
```

### 3.2 获取消息列表

**GET** `/conversation/{id}/messages`

**认证**: 需要 Token（通过 `Authorization: Bearer <token>` 传递）

**后端 DTO 定义**: `MessageDTO.java`

```java
// 后端 MessageDTO 字段（确认版）
@Data
public class MessageDTO {
    private Long id;                // 消息ID
    private Long conversationId;    // 会话ID
    private Long userId;            // 用户ID
    private String username;        // 用户名（可为 null）
    private String role;            // 消息角色（user/assistant）
    private String content;         // 消息内容
    private String title;           // 消息标题（可为 null）
    private LocalDateTime createdAt;  // 创建时间
    private LocalDateTime updatedAt;  // 更新时间
}
```

**响应格式**:
```typescript
{
  code: 200,
  message: "操作成功",
  data: [
    {
      id: number;                // 消息 ID
      conversationId: number;    // 会话 ID
      userId: number;            // 用户 ID
      username: string | null;   // ⭐ 用户名（可为 null）
      role: string;              // 角色：user | assistant
      content: string;           // 消息内容
      title: string | null;      // 消息标题（可为 null）
      createdAt: string;         // 创建时间（ISO 8601 格式）
      updatedAt: string;         // 更新时间（ISO 8601 格式）
    }
  ]
}
```

**TypeScript 类型定义（与后端 MessageDTO 完全对应）**:
```typescript
interface MessageDTO {
  id: number;
  conversationId: number;
  userId: number;
  username: string | null;
  role: 'user' | 'assistant';
  content: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**前端使用示例**:
```tsx
// 消息列表组件
function MessageList({ messages }: { messages: MessageDTO[] }) {
  return (
    <div className="messages">
      {messages.map(msg => (
        <div key={msg.id} className={`message ${msg.role}`}>
          {/* 显示发送者用户名 */}
          {msg.username && (
            <div className="sender">{msg.username}</div>
          )}
          <div className="content">{msg.content}</div>
          <time>
            {new Date(msg.createdAt).toLocaleString()}
          </time>
        </div>
      ))}
    </div>
  );
}
```

### 3.3 删除会话

**DELETE** `/conversation/{id}`

**说明：** 逻辑删除，不会物理删除数据

**响应：**
```typescript
{
  code: 200,
  message: "删除成功",
  data: null
}
```

---

## 4. SSE 流式对话接口

### 4.1 发起流式对话

**POST** `/agent/chat/stream`

**请求体：**
```typescript
{
  message: string;             // 必填：用户消息
  conversationId?: number;     // 可选：已有会话 ID（首次不传则自动创建）
  sessionId?: string;          // 可选：会话标识
}
```

**响应：** Server-Sent Events (SSE) 流

**SSE 事件格式：**
```typescript
// chunk 事件
interface ChunkData {
  type: 'chunk';
  content: string;            // AI 回复的片段
  index: number;              // 片段索引
  reasoning?: string;         // 推理过程（可选）
}

// done 事件
interface DoneData {
  type: 'done';
  info: string;               // 完成信息
  conversationId: number;     // 会话 ID
  messageId: string;          // ⭐ 消息 ID（用于 abort）
}

// error 事件
interface ErrorData {
  type: 'error';
  message: string;            // 错误信息
}

// ping 事件（心跳）
interface PingData {
  type: 'ping';
}
```

**前端对接示例：**
```typescript
import { fetchEventSource } from '@microsoft/fetch-event-source';

let currentMessageId: string | null = null;
let currentConversationId: number | null = null;

async function startStreaming(message: string, conversationId?: number) {
  await fetchEventSource('/agent/chat/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, conversationId }),
    
    onmessage(event) {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'chunk':
          // 打字机效果显示
          appendToAIResponse(data.content);
          break;
          
        case 'done':
          // ⭐ 保存 messageId 和 conversationId
          currentMessageId = data.messageId;
          currentConversationId = data.conversationId;
          console.log('流式完成，conversationId:', data.conversationId);
          break;
          
        case 'error':
          showError(data.message);
          break;
          
        case 'ping':
          // 心跳，忽略
          break;
      }
    },
    
    onerror(error) {
      console.error('SSE 错误:', error);
    },
  });
}
```

### 4.2 中断流式生成

**POST** `/agent/chat/stream/abort`

**请求体：**
```typescript
{
  messageId: string;  // 从 done 事件中获取
}
```

**响应：**
```typescript
{
  code: 200,
  data: boolean;  // true = 成功中断，false = 任务已结束
}
```

**前端使用示例：**
```typescript
async function abortGeneration() {
  if (!currentMessageId) {
    console.warn('没有活跃的流式任务');
    return;
  }

  const response = await fetch('/agent/chat/stream/abort', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messageId: currentMessageId }),
  });

  const result = await response.json();
  
  if (result.data) {
    console.log('流式生成已中断');
  } else {
    console.log('任务已结束，无法中断');
  }
  
  // 清除状态
  currentMessageId = null;
}
```

**⭐ 清理机制说明：**

| 场景 | 后端行为 |
|------|----------|
| 新建会话 + abort | ✅ 删除空会话<br>✅ 删除用户消息<br>✅ 删除 Redis 数据 |
| 已有会话 + abort | ✅ 保留会话<br>✅ 删除本次用户消息<br>✅ 删除 Redis 数据 |

**前端无需额外处理，后端会自动清理。**

### 4.3 中断流式生成（RESTful）

**POST** `/api/v1/chat/{conversationId}/abort`

通过 conversationId 中断该会话下最新的活跃流。

**使用场景：** 当你不知道 messageId，但知道 conversationId 时可以使用。

---

## 5. 管理员接口

### 5.1 获取用户列表

**GET** `/api/admin/users?page=1&pageSize=10&keyword=admin&role=USER&status=ACTIVE`

**响应：**
```typescript
{
  code: 200,
  data: {
    list: Array<{
      id: number;
      username: string;
      email: string;
      role: string;
      status: string;      // "ACTIVE" | "DISABLED"
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }
}
```

### 5.2 创建用户

**POST** `/api/admin/users`

**请求体：**
```typescript
{
  username: string;
  email: string;
  password: string;       // 至少 6 位
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
}
```

### 5.3 更新用户

**PUT** `/api/admin/users/{id}`

**请求体（所有字段可选）：**
```typescript
{
  username?: string;
  email?: string;
  password?: string;      // 如果提供，会自动加密
  role?: 'ADMIN' | 'USER';
  status?: 'ACTIVE' | 'DISABLED';
}
```

### 5.4 删除用户

**DELETE** `/api/admin/users/{id}`

**说明：** 逻辑删除，删除后用户数据不会真正从数据库移除，只是标记为已删除。

**前端注意：** 删除后该用户不会再出现在列表中。

### 5.5 切换用户状态

**PATCH** `/api/admin/users/{id}/toggle-status`

**说明：** 在 ACTIVE 和 DISABLED 之间切换

---

## 6. 数据类型对照表

### 时间格式

所有时间字段均为 **ISO 8601** 格式：

```typescript
// 示例
"2026-04-10T12:00:00"        // 本地时间
"2026-04-10T12:00:00Z"       // UTC 时间

// 前端转换
const date = new Date("2026-04-10T12:00:00");
const formatted = date.toLocaleString('zh-CN');  // "2026/4/10 12:00:00"
```

### 状态码

**用户状态：**
- `status: 1` 或 `statusText: "ACTIVE"` → 启用
- `status: 0` 或 `statusText: "DISABLED"` → 禁用

**角色：**
- `"ADMIN"` → 管理员
- `"USER"` → 普通用户

**消息角色：**
- `"user"` → 用户消息
- `"assistant"` → AI 回复

---

## 7. 前端迁移指南

### 从旧版本升级

如果你的前端代码已经在运行，需要进行以下调整：

#### 7.1 会话列表适配

**旧代码：**
```typescript
// 旧的数据结构
interface OldConversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}
```

**新代码：**
```typescript
// 新的数据结构
interface ConversationDTO {
  id: number;
  userId: number;
  title: string;
  lastMessageContent: string | null;  // ⭐ 新增
  lastMessageTime: string | null;     // ⭐ 新增
  createdAt: string;
  updatedAt: string;
}

// 使用新增字段
function renderConversation(conv: ConversationDTO) {
  return (
    <div>
      <h3>{conv.title}</h3>
      <p>{conv.lastMessageContent?.substring(0, 50) || '暂无消息'}</p>
      <time>{conv.lastMessageTime ? format(conv.lastMessageTime) : '暂无消息'}</time>
    </div>
  );
}
```

#### 7.2 消息列表适配

**旧代码：**
```typescript
// 旧的数据结构（没有 username）
interface OldMessage {
  id: number;
  userId: number;
  role: string;
  content: string;
  createdAt: string;
}
```

**新代码：**
```typescript
// 新的数据结构
interface MessageDTO {
  id: number;
  userId: number;
  username: string | null;  // ⭐ 新增
  role: string;
  content: string;
  createdAt: string;
}

// 使用新增的 username
function renderMessage(msg: MessageDTO) {
  return (
    <div className={msg.role}>
      {msg.username && <span>{msg.username}</span>}  {/* ⭐ 显示用户名 */}
      <p>{msg.content}</p>
      <time>{format(msg.createdAt)}</time>
    </div>
  );
}
```

#### 7.3 用户信息适配

**旧代码：**
```typescript
// 旧的数据结构（包含 password）
interface OldUser {
  id: number;
  username: string;
  email: string;
  password: string | null;  // 以前有，现在没有
  role: string;
}
```

**新代码：**
```typescript
// 新的数据结构（不含 password）
interface UserDTO {
  id: number;
  username: string;
  email: string;
  role: string;
  status: number;           // ⭐ 新增
  statusText: string;       // ⭐ 新增
}

// 不再需要手动清除密码
const user = await fetchUser(id);
// user.password 现在是 undefined（不再存在）
```

---

## 8. 完整示例

### 8.1 会话页面完整示例

```tsx
import { useState, useEffect } from 'react';

interface MessageDTO {
  id: number;
  conversationId: number;
  userId: number;
  username: string | null;
  role: 'user' | 'assistant';
  content: string;
  title: string | null;
  createdAt: string;
}

export function ConversationPage({ conversationId }: { conversationId: number }) {
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(`/conversation/${conversationId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.code === 200) {
          setMessages(result.data);
        }
      } catch (error) {
        console.error('加载消息失败:', error);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [conversationId]);

  if (loading) return <div>加载中...</div>;

  return (
    <div className="conversation">
      {messages.map(msg => (
        <div key={msg.id} className={`message ${msg.role}`}>
          {/* 显示发送者用户名 */}
          {msg.username && (
            <div className="sender-name">{msg.username}</div>
          )}
          <div className="content">{msg.content}</div>
          <div className="timestamp">
            {new Date(msg.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 8.2 会话列表完整示例

```tsx
import { useState, useEffect } from 'react';

interface ConversationDTO {
  id: number;
  userId: number;
  title: string;
  lastMessageContent: string | null;
  lastMessageTime: string | null;
  createdAt: string;
}

export function ConversationList() {
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);

  useEffect(() => {
    async function loadConversations() {
      const response = await fetch('/conversation/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.code === 200) {
        setConversations(result.data);
      }
    }

    loadConversations();
  }, []);

  return (
    <ul className="conversation-list">
      {conversations.map(conv => (
        <li key={conv.id}>
          <h3>{conv.title}</h3>
          {/* 最新消息预览 */}
          {conv.lastMessageContent && (
            <p className="preview">
              {conv.lastMessageContent.substring(0, 50)}...
            </p>
          )}
          <time>
            {conv.lastMessageTime 
              ? new Date(conv.lastMessageTime).toLocaleString('zh-CN')
              : '暂无消息'
            }
          </time>
        </li>
      ))}
    </ul>
  );
}
```

---

## 9. 常见问题

### Q1: 为什么消息列表现在返回 username？

**A:** 为了避免前端需要额外请求用户信息。以前获取消息列表后，前端需要针对每条消息调用用户接口获取用户名（N+1 问题），现在后端一次性批量返回，提升了性能。

### Q2: 会话列表的 `lastMessageContent` 是什么？

**A:** 这是该会话的最后一条消息内容，用于在列表页显示预览。如果会话没有任何消息，该字段为 `null`。

### Q3: Abort 后前端需要做什么清理？

**A:** 几乎不需要。后端会自动清理：
- ✅ Redis 临时数据
- ✅ 未完成的用户消息
- ✅ 如果是新建会话，会删除空会话

前端只需要清除自己的状态（如 `currentMessageId = null`）。

### Q4: 时间格式如何解析？

**A:** 所有时间都是 ISO 8601 格式，直接用 `new Date(string)` 即可：
```typescript
const date = new Date("2026-04-10T12:00:00");
const formatted = date.toLocaleString('zh-CN');  // "2026/4/10 12:00:00"
```

### Q5: 用户接口为什么不返回密码了？

**A:** 出于安全考虑，密码属于敏感信息，不应通过 API 返回。如果需要验证密码，请使用专门的密码验证接口。

---

## 10. 错误处理

### 常见错误码

| 错误码 | 说明 | 前端处理 |
|--------|------|----------|
| 200 | 成功 | 正常处理 |
| 400 | 请求参数错误 | 提示用户检查输入 |
| 401 | 未认证/Token 无效 | 跳转到登录页 |
| 403 | 权限不足 | 提示用户无权限 |
| 404 | 资源不存在 | 提示用户资源不存在 |
| 409 | 资源冲突（如用户名已存在） | 提示具体冲突信息 |
| 500 | 服务器内部错误 | 提示用户稍后重试 |

### 错误处理示例

```typescript
async function handleApiCall() {
  try {
    const response = await fetch('/api/endpoint', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();

    if (result.code === 200) {
      // 成功
      return result.data;
    } else if (result.code === 401) {
      // Token 无效，跳转到登录
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else {
      // 其他错误
      showError(result.message);
    }
  } catch (error) {
    console.error('网络错误:', error);
    showError('网络异常，请稍后重试');
  }
}
```

---

## 11. 性能优化建议

### 11.1 利用批量查询优势

现在后端已经优化了批量查询，前端无需额外优化。但可以注意：

- ✅ **消息列表**：一次性加载所有消息，无需循环请求用户信息
- ✅ **会话列表**：直接显示最新消息预览，无需额外请求

### 11.2 合理使用 Abort

- ✅ 用户切换到其他会话时，调用 abort 中断当前流式生成
- ✅ 用户关闭页面时，浏览器会自动断开 SSE 连接，后端会检测到并触发 abort

```typescript
// 切换会话时
async function switchConversation(newConversationId: number) {
  // 先中断当前的流式生成（如果有）
  if (currentMessageId) {
    await abortGeneration();
  }
  
  // 加载新会话
  loadMessages(newConversationId);
}
```

---

**文档版本**: v3.0
**更新日期**: 2026-04-10
**维护者**: 后端团队

## 相关文档

- [Agent 服务对接文档](./agent-api.md) - Python Agent (LangChain + LangGraph + DeepSeek) 数据结构
- [SSE 流式对话完整指南](./SSE_ABORT_GUIDE.md) - 流式对话和 abort 机制详解

如有疑问，请联系后端开发团队。
