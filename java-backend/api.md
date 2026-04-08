# Agent 后端系统 API 文档

基础地址：`http://localhost:8080`

统一返回格式：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

---

## 1. 认证模块（/auth）

### 1.1 用户注册

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "123456"
  }'
```

**预期响应：**
```json
{
  "code": 200,
  "message": "注册成功",
  "data": null
}
```

---

### 1.2 用户登录

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**预期响应：**
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

> 💡 后续所有接口都需要携带此 Token，将下方 `$TOKEN` 替换为实际值。

---

## 2. Agent 模块（/agent）

### 2.1 AI 对话（创建新会话）

不传 `conversationId`，系统自动创建新会话。

```bash
curl -X POST http://localhost:8080/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "你好，AI助手"
  }'
```

**预期响应：**
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

---

### 2.2 AI 对话（继续已有会话）

传入 `conversationId`，在同一会话中继续对话。

```bash
curl -X POST http://localhost:8080/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "你能做什么？",
    "conversationId": 1
  }'
```

**预期响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "reply": "我可以回答你的问题、协助编写代码、提供建议等...",
    "conversationId": 1
  }
}
```

---

## 3. 会话模块（/conversation）

### 3.1 获取会话列表

```bash
curl -X GET http://localhost:8080/conversation/list \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应：**
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

### 3.2 获取会话消息列表

```bash
curl -X GET http://localhost:8080/conversation/1/messages \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应：**
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

---

### 3.3 删除会话

```bash
curl -X DELETE http://localhost:8080/conversation/1 \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应：**
```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

---

## 4. 用户模块（/user）

### 4.1 获取用户信息

```bash
curl -X GET http://localhost:8080/user/1 \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应：**
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

---

### 4.2 更新用户信息（仅管理员或本人）

```bash
curl -X PUT http://localhost:8080/user/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "newemail@example.com"
  }'
```

**预期响应：**
```json
{
  "code": 200,
  "message": "更新成功",
  "data": null
}
```

---

## 完整测试流程（一键脚本）

```bash
#!/bin/bash
BASE_URL="http://localhost:8080"

echo "========== 1. 注册新用户 =========="
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"123456"}' | jq

echo ""
echo "========== 2. 登录获取 Token =========="
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}' | jq -r '.data.token')

echo "Token: $TOKEN"
echo ""
echo "========== 3. AI 对话（创建会话） =========="
RESP=$(curl -s -X POST "$BASE_URL/agent/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"你好"}')

echo "$RESP" | jq
CONV_ID=$(echo "$RESP" | jq -r '.data.conversationId')

echo ""
echo "========== 4. 继续对话 =========="
curl -s -X POST "$BASE_URL/agent/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"message\":\"你能做什么？\",\"conversationId\":$CONV_ID}" | jq

echo ""
echo "========== 5. 获取会话列表 =========="
curl -s -X GET "$BASE_URL/conversation/list" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "========== 6. 获取消息列表 =========="
curl -s -X GET "$BASE_URL/conversation/$CONV_ID/messages" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "========== 7. 获取用户信息 =========="
USER_ID=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}' | jq -r '.data.userId')

curl -s -X GET "$BASE_URL/user/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "========== 8. 删除会话 =========="
curl -s -X DELETE "$BASE_URL/conversation/$CONV_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "========== 全部完成 =========="
```

---

## 错误响应示例

### 401 未认证
```bash
curl -X GET http://localhost:8080/conversation/list
```
```json
{
  "code": 403,
  "message": "权限不足",
  "data": null
}
```

### 参数校验失败
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":""}'
```
```json
{
  "code": 400,
  "message": "用户名不能为空",
  "data": null
}
```

### 业务异常
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}'
```
```json
{
  "code": 500,
  "message": "密码错误",
  "data": null
}
```
