# Agent 后端系统

基于 Spring Boot 3.4.4 的 AI Agent 后端系统，提供用户管理、权限控制、对话管理和 AI Agent 调用功能。

## 技术栈

- **Spring Boot 3.4.4** - 核心框架
- **Spring Security + JWT** - 认证授权
- **MyBatis-Plus 3.5.9** - ORM 框架
- **MySQL 8.0** - 关系型数据库
- **Redis** - 缓存
- **Lombok** - 代码生成
- **Spring Retry** - 重试机制

## 项目结构

```
java-backend/
├── pom.xml
├── sql/
│   └── init.sql                      # 数据库初始化脚本
└── src/main/
    ├── java/com/caius/agent/
    │   ├── AgentApplication.java     # 启动类
    │   ├── common/                   # 通用模块
    │   │   ├── config/               # 配置类
    │   │   │   ├── MybatisPlusConfig.java
    │   │   │   ├── RedisConfig.java
    │   │   │   ├── RestTemplateConfig.java
    │   │   │   └── SecurityConfig.java
    │   │   ├── exception/            # 异常处理
    │   │   │   ├── BusinessException.java
    │   │   │   └── GlobalExceptionHandler.java
    │   │   ├── result/               # 统一返回
    │   │   │   └── Result.java
    │   │   └── util/                 # 工具类
    │   │       └── JwtUtil.java
    │   ├── module/                   # 业务模块
    │   │   ├── agent/                # Agent 模块
    │   │   │   ├── controller/
    │   │   │   │   └── AgentController.java
    │   │   │   ├── dto/
    │   │   │   │   ├── ChatRequest.java
    │   │   │   │   └── ChatResponse.java
    │   │   │   └── service/
    │   │   │       ├── AgentService.java
    │   │   │       └── impl/AgentServiceImpl.java
    │   │   ├── auth/                 # 认证模块
    │   │   │   ├── controller/
    │   │   │   │   └── AuthController.java
    │   │   │   ├── dto/
    │   │   │   │   ├── LoginRequest.java
    │   │   │   │   └── RegisterRequest.java
    │   │   │   ├── filter/
    │   │   │   │   └── JwtAuthenticationFilter.java
    │   │   │   └── service/
    │   │   │       ├── AuthService.java
    │   │   │       └── impl/AuthServiceImpl.java
    │   │   ├── conversation/         # 会话模块
    │   │   │   ├── controller/
    │   │   │   │   └── ConversationController.java
    │   │   │   ├── entity/
    │   │   │   │   ├── Conversation.java
    │   │   │   │   └── Message.java
    │   │   │   └── service/
    │   │   │       ├── ConversationService.java
    │   │   │       └── impl/ConversationServiceImpl.java
    │   │   ├── gateway/              # Gateway 模块
    │   │   │   └── PythonAgentGateway.java
    │   │   └── user/                 # 用户模块
    │   │       ├── controller/
    │   │       │   └── UserController.java
    │   │       ├── entity/
    │   │       │   └── User.java
    │   │       └── service/
    │   │           ├── UserService.java
    │   │           └── impl/UserServiceImpl.java
    │   └── dao/                      # 数据访问层
    │       ├── ConversationMapper.java
    │       ├── MessageMapper.java
    │       └── UserMapper.java
    └── resources/
        ├── application.yml
        └── application-dev.yml
```

## 数据库设计

### 用户表 (user)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 用户ID |
| username | VARCHAR(50) | 用户名 |
| email | VARCHAR(100) | 邮箱 |
| password | VARCHAR(255) | 密码（BCrypt加密） |
| role | VARCHAR(20) | 角色（USER/ADMIN） |
| status | TINYINT | 状态（0-禁用，1-启用） |
| deleted | TINYINT | 逻辑删除 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 会话表 (conversation)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 会话ID |
| user_id | BIGINT | 用户ID |
| title | VARCHAR(200) | 会话标题 |
| deleted | TINYINT | 逻辑删除 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 消息表 (message)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 消息ID |
| conversation_id | BIGINT | 会话ID |
| user_id | BIGINT | 用户ID |
| role | VARCHAR(20) | 角色（user/assistant） |
| content | TEXT | 消息内容 |
| deleted | TINYINT | 逻辑删除 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

## API 接口

### 认证接口

#### POST /auth/register
注册新用户

**请求体：**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "123456"
}
```

#### POST /auth/login
用户登录获取 Token

**请求体：**
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

### Agent 接口

#### POST /agent/chat
发送消息给 AI Agent

**请求头：**
```
Authorization: Bearer {token}
```

**请求体：**
```json
{
  "message": "你好，AI助手",
  "conversationId": 1  // 可选，不传则创建新会话
}
```

**响应：**
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

### 会话接口

#### GET /conversation/list
获取用户会话列表

**请求头：**
```
Authorization: Bearer {token}
```

#### GET /conversation/{id}/messages
获取会话消息列表

**请求头：**
```
Authorization: Bearer {token}
```

#### DELETE /conversation/{id}
删除会话

**请求头：**
```
Authorization: Bearer {token}
```

### 用户接口

#### GET /user/{id}
获取用户信息

**请求头：**
```
Authorization: Bearer {token}
```

#### PUT /user/{id}
更新用户信息（仅管理员或用户本人）

**请求头：**
```
Authorization: Bearer {token}
```

## 快速开始

### 环境要求
- Java 21+
- Maven 3.8+
- MySQL 8.0+
- Redis 6.0+

### 1. 初始化数据库
```bash
mysql -u root -p < sql/init.sql
```

### 2. 修改配置
编辑 `src/main/resources/application-dev.yml`：
- 修改 MySQL 连接信息
- 修改 Redis 连接信息
- 修改 Python Agent 服务地址

### 3. 启动项目
```bash
mvn clean package -DskipTests
java -jar target/java-backend-0.0.1-SNAPSHOT.jar
```

或使用 Maven 插件：
```bash
mvn spring-boot:run
```

### 4. 测试账号
- 管理员：admin / admin123
- 普通用户：user / admin123

## Python Agent 对接

系统通过 HTTP POST 调用 Python Agent 服务：

**请求格式：**
```
POST {python-agent.url}{python-agent.chat-endpoint}
Content-Type: application/json

{
  "message": "带上下文的完整对话",
  "session_id": "会话ID"
}
```

**响应格式：**
```json
{
  "reply": "AI 回复内容"
}
```

配置项：
```yaml
python-agent:
  url: http://localhost:5000
  chat-endpoint: /api/chat
  timeout: 30000
  retry:
    max-attempts: 3
    delay: 1000
```
