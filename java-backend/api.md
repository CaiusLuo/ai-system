# Agent 后端系统 API 文档

**基础地址：** `http://localhost:8080`

**统一返回格式：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

---

## 目录

- [1. 认证模块（/auth）](#1-认证模块auth)
- [2. 用户模块（/user）](#2-用户模块user)
- [3. Agent 对话模块（/agent）](#3-agent-对话模块agent)
- [4. 会话模块（/conversation）](#4-会话模块conversation)
- [5. 管理模块（/api/admin）](#5-管理模块apiadmin)
- [完整测试流程](#完整测试流程)
- [错误处理](#错误处理)

---

## 1. 认证模块（/auth）

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

**响应示例：**
```json
{
  "code": 200,
  "message": "注册成功",
  "data": null
}
```

**错误响应：**
- `400` - 参数校验失败（用户名/邮箱为空、密码过短等）
- `409` - 用户名或邮箱已存在

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

**响应示例：**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "userId": 1,
    "username": "admin",
    "role": "ADMIN"
  }
}
```

**错误响应：**
- `400` - 用户名或密码为空
- `500` - 用户名不存在或密码错误

> 💡 **Token 使用说明**  
> 登录成功后，将返回的 `token` 值用于后续请求的 `Authorization` 头：  
> `Authorization: Bearer $TOKEN`

---

## 2. 用户模块（/user）

### 2.1 获取用户信息

**GET** `/user/{id}`

**权限：** 管理员或用户本人

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "ADMIN",
    "status": 1
  }
}
```

**错误响应：**
- `401` - 未认证
- `403` - 权限不足
- `404` - 用户不存在

---

### 2.2 更新用户信息

**PUT** `/user/{id}`

**权限：** 管理员或用户本人

**请求体：**
```json
{
  "email": "newemail@example.com"
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "更新成功",
  "data": null
}
```

**错误响应：**
- `400` - 参数校验失败
- `401` - 未认证
- `403` - 权限不足
- `404` - 用户不存在
- `409` - 邮箱已存在

---

## 3. Agent 对话模块（/agent）

### 3.1 AI 对话（非流式）

**POST** `/agent/chat`

**权限：** 需要认证

**请求体（创建新会话）：**
```json
{
  "message": "你好，AI助手"
}
```

**请求体（继续已有会话）：**
```json
{
  "message": "你能做什么？",
  "conversationId": 1
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "reply": "你好！我是AI助手，有什么可以帮助你的吗？",
    "conversationId": 1
  }
}
```

**错误响应：**
- `400` - 消息内容为空
- `401` - 未认证
- `500` - AI 服务异常

---

### 3.2 AI 对话（流式 - SSE）

**POST** `/agent/chat/stream`

**权限：** 需要认证

**Content-Type：** `application/json`  
**响应类型：** `text/event-stream`

**请求体：**
```json
{
  "message": "你好，AI助手",
  "conversationId": 1
}
```

**响应示例（SSE 流）：**
```
data: {"content": "你好"}
data: {"content": "！我是"}
data: {"content": "AI助手"}
data: {"done": true, "conversationId": 1}
```

**错误响应：**
- `400` - 消息内容为空
- `401` - 未认证
- `500` - AI 服务异常

---

## 4. 会话模块（/conversation）

### 4.1 获取会话列表

**GET** `/conversation/list`

**权限：** 需要认证（返回当前用户的会话）

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "title": "你好，AI助手",
      "createdAt": "2026-04-08T23:00:00",
      "updatedAt": "2026-04-08T23:00:00"
    }
  ]
}
```

---

### 4.2 获取会话消息列表

**GET** `/conversation/{id}/messages`

**权限：** 需要认证

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "conversationId": 1,
      "userId": 1,
      "role": "user",
      "content": "你好，AI助手",
      "createdAt": "2026-04-08T23:00:00"
    },
    {
      "id": 2,
      "conversationId": 1,
      "userId": 1,
      "role": "assistant",
      "content": "你好！我是AI助手...",
      "createdAt": "2026-04-08T23:00:01"
    }
  ]
}
```

**错误响应：**
- `404` - 会话不存在

---

### 4.3 删除会话

**DELETE** `/conversation/{id}`

**权限：** 需要认证

**响应示例：**
```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

**错误响应：**
- `404` - 会话不存在

---

## 5. 管理模块（/api/admin）

> 🔐 **认证要求**
> 所有 `/api/admin/**` 接口需要 JWT 认证，且用户必须具有 `ADMIN` 角色。
> 
> 使用方式：在请求头中添加 `Authorization: Bearer <token>`

### 5.1 获取用户列表

**GET** `/api/admin/users`

**权限：** 需要 ADMIN 角色

**查询参数：**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 10 | 每页数量（最大 100） |
| keyword | string | 否 | - | 搜索关键词（匹配用户名或邮箱） |
| role | string | 否 | - | 角色筛选（ADMIN/USER） |
| status | string | 否 | - | 状态筛选（ACTIVE/DISABLED） |

**请求示例：**
```bash
# 先登录获取 Token
TOKEN=$(curl -s -X POST "http://localhost:8080/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')

# 使用 Token 访问
curl -X GET "http://localhost:8080/api/admin/users?page=1&pageSize=10&role=ADMIN" \
  -H "Authorization: Bearer $TOKEN"
```

**响应示例：**
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
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 10
  }
}
```

**错误响应：**
- `401` - Token 无效或缺失
- `403` - 权限不足（非 ADMIN 角色）

---

### 5.2 创建用户

**POST** `/api/admin/users`

**权限：** 需要 ADMIN 角色

**请求体：**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "role": "USER",
  "status": "ACTIVE"
}
```

**字段校验：**
| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| username | string | ✅ | 3-50 字符 |
| email | string | ✅ | 邮箱格式 |
| password | string | ✅ | 至少 6 位 |
| role | string | ✅ | ADMIN 或 USER |
| status | string | ✅ | ACTIVE 或 DISABLED |

**请求示例：**
```bash
curl -X POST "http://localhost:8080/api/admin/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "role": "USER",
    "status": "ACTIVE"
  }'
```

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 3,
    "username": "testuser",
    "email": "test@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2024-07-20T10:00:00Z"
  }
}
```

**错误响应：**
- `400` - 参数校验失败
- `401` - Token 无效或缺失
- `403` - 权限不足（非 ADMIN 角色）
- `409` - 用户名或邮箱已存在

---

### 5.3 更新用户

**PUT** `/api/admin/users/{id}`

**权限：** 需要 ADMIN 角色

**请求体（部分更新）：**
```json
{
  "username": "updatedadmin",
  "email": "updated@example.com"
}
```

**请求示例：**
```bash
curl -X PUT "http://localhost:8080/api/admin/users/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "updatedadmin",
    "email": "updated@example.com"
  }'
```

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "username": "updatedadmin",
    "email": "updated@example.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**错误响应：**
- `400` - 参数校验失败
- `401` - Token 无效或缺失
- `403` - 权限不足（非 ADMIN 角色）
- `404` - 用户不存在
- `409` - 用户名或邮箱已存在

---

### 5.4 删除用户

**DELETE** `/api/admin/users/{id}`

**权限：** 需要 ADMIN 角色

**说明：** 逻辑删除（设置 `deleted=1`），支持幂等操作。

**请求示例：**
```bash
curl -X DELETE "http://localhost:8080/api/admin/users/1" \
  -H "Authorization: Bearer $TOKEN"
```

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": null
}
```

**错误响应：**
- `401` - Token 无效或缺失
- `403` - 权限不足（非 ADMIN 角色）
- `404` - 用户不存在（已被删除或从未创建）

---

### 5.5 切换用户状态

**PATCH** `/api/admin/users/{id}/toggle-status`

**权限：** 需要 ADMIN 角色

**说明：** 在 `ACTIVE` (1) 和 `DISABLED` (0) 之间切换，幂等操作。

**请求示例：**
```bash
curl -X PATCH "http://localhost:8080/api/admin/users/1/toggle-status" \
  -H "Authorization: Bearer $TOKEN"
```

**响应示例：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "ADMIN",
    "status": "DISABLED",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**错误响应：**
- `401` - Token 无效或缺失
- `403` - 权限不足（非 ADMIN 角色）
- `404` - 用户不存在

---

## 完整测试流程

### 一键测试脚本

```bash
#!/bin/bash
BASE_URL="http://localhost:8080"

echo "========== 1. 登录获取 Token =========="
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')

echo "Token: $TOKEN"
echo ""

echo "========== 2. 管理员：获取用户列表 =========="
curl -s -X GET "$BASE_URL/api/admin/users?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "========== 3. 管理员：创建用户 =========="
curl -s -X POST "$BASE_URL/api/admin/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123","role":"USER","status":"ACTIVE"}' | jq

echo ""
echo "========== 4. 注册新用户 =========="
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","email":"newuser@example.com","password":"123456"}' | jq

echo ""
echo "========== 5. 新用户登录 =========="
NEW_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"123456"}' | jq -r '.data.token')

echo "New Token: $NEW_TOKEN"
echo ""

echo "========== 6. AI 对话（创建会话） =========="
RESP=$(curl -s -X POST "$BASE_URL/agent/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -d '{"message":"你好"}')

echo "$RESP" | jq
CONV_ID=$(echo "$RESP" | jq -r '.data.conversationId')

echo ""
echo "========== 7. 继续对话 =========="
curl -s -X POST "$BASE_URL/agent/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -d "{\"message\":\"你能做什么？\",\"conversationId\":$CONV_ID}" | jq

echo ""
echo "========== 8. 获取会话列表 =========="
curl -s -X GET "$BASE_URL/conversation/list" \
  -H "Authorization: Bearer $NEW_TOKEN" | jq

echo ""
echo "========== 9. 获取消息列表 =========="
curl -s -X GET "$BASE_URL/conversation/$CONV_ID/messages" \
  -H "Authorization: Bearer $NEW_TOKEN" | jq

echo ""
echo "========== 10. 获取用户信息 =========="
USER_ID=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"123456"}' | jq -r '.data.userId')

curl -s -X GET "$BASE_URL/user/$USER_ID" \
  -H "Authorization: Bearer $NEW_TOKEN" | jq

echo ""
echo "========== 11. 删除会话 =========="
curl -s -X DELETE "$BASE_URL/conversation/$CONV_ID" \
  -H "Authorization: Bearer $NEW_TOKEN" | jq

echo ""
echo "========== 12. 测试无认证访问（应返回 403） =========="
curl -s -X GET "$BASE_URL/api/admin/users?page=1&pageSize=10" | jq

echo ""
echo "========== 全部完成 =========="
```

---

## 错误处理

### 全局异常处理

系统通过 `GlobalExceptionHandler` 统一处理所有异常。

### 常见错误码

| HTTP 状态码 | 业务 code | 说明 | 示例场景 |
|-------------|-----------|------|----------|
| 200 | 200 | 成功 | 正常请求 |
| 400 | 400 | 参数校验失败 | 缺少必填字段、格式错误 |
| 401 | 401 | 未认证 | Token 缺失或过期 |
| 403 | 403 | 权限不足 | 非管理员访问管理接口 |
| 404 | 404 | 资源不存在 | 用户/会话 ID 不存在 |
| 409 | 409 | 资源冲突 | 用户名/邮箱已存在 |
| 500 | 500 | 服务器内部错误 | AI 服务异常、数据库错误 |

### 错误响应示例

**参数校验失败：**
```json
{
  "code": 400,
  "message": "密码长度至少6位",
  "data": null
}
```

**未认证：**
```json
{
  "code": 403,
  "message": "权限不足",
  "data": null
}
```

**业务异常：**
```json
{
  "code": 409,
  "message": "用户名已存在",
  "data": null
}
```

---

## 附录

### API 端点汇总

| 模块 | 方法 | 路径 | 认证 | 权限 | 说明 |
|------|------|------|------|------|------|
| 认证 | POST | `/auth/register` | ❌ | 无 | 用户注册 |
| 认证 | POST | `/auth/login` | ❌ | 无 | 用户登录 |
| 用户 | GET | `/user/{id}` | ✅ | 本人或 ADMIN | 获取用户信息 |
| 用户 | PUT | `/user/{id}` | ✅ | 本人或 ADMIN | 更新用户信息 |
| Agent | POST | `/agent/chat` | ✅ | 已认证用户 | AI 对话（非流式） |
| Agent | POST | `/agent/chat/stream` | ✅ | 已认证用户 | AI 对话（流式 SSE） |
| 会话 | GET | `/conversation/list` | ✅ | 已认证用户 | 获取会话列表 |
| 会话 | GET | `/conversation/{id}/messages` | ✅ | 已认证用户 | 获取消息列表 |
| 会话 | DELETE | `/conversation/{id}` | ✅ | 已认证用户 | 删除会话 |
| 管理 | GET | `/api/admin/users` | ✅ | ADMIN | 获取用户列表 |
| 管理 | POST | `/api/admin/users` | ✅ | ADMIN | 创建用户 |
| 管理 | PUT | `/api/admin/users/{id}` | ✅ | ADMIN | 更新用户 |
| 管理 | DELETE | `/api/admin/users/{id}` | ✅ | ADMIN | 删除用户 |
| 管理 | PATCH | `/api/admin/users/{id}/toggle-status` | ✅ | ADMIN | 切换用户状态 |

### 技术栈

- **框架：** Spring Boot 3.x + Java 21
- **认证：** JWT (Spring Security)
- **数据库：** MySQL 8.0 + MyBatis-Plus 3.5.14
- **缓存：** Redis 6.0+
- **AI 集成：** OpenAI API 兼容接口

### 安全说明

- ✅ 密码使用 BCrypt 加密存储
- ✅ 所有查询使用参数化防止 SQL 注入
- ✅ 逻辑删除保护数据完整性
- ✅ **管理接口已启用 JWT 认证（需要 ADMIN 角色）**
- ✅ CORS 配置允许前端开发服务器访问
- ✅ Token 24 小时自动过期
- ✅ 无状态设计（不存储 session）

---

**文档版本：** v3.0.0  
**更新日期：** 2026-04-09  
**更新说明：** 启用 JWT 认证，所有 Admin API 需要 ADMIN 角色  
**维护者：** caius (luoxiongca5@gmail.com)
