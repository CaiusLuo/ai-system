# Agent 后端系统

基于 Spring Boot 3.4.4 的 AI Agent 后端系统，提供用户管理、认证授权、SSE 流式对话和 AI Agent 调用功能。

## 最近更新

### 2026-04-10
- ✅ **逻辑删除优化**：MyBatis-Plus 自动过滤已删除数据
- ✅ **性能优化**：批量查询避免 N+1 问题（IO 次数降低 80%+）
- ✅ **Abort 清理**：智能清理机制，新建会话 abort 时自动删除空会话
- ✅ **DTO 设计**：MessageDTO/ConversationDTO/UserDTO 提升安全性和性能
- ✅ **安全性提升**：用户接口返回 DTO 隐藏密码字段

## 技术栈

- **Spring Boot 3.4.4** + **Java 21**
- **Spring Security + JWT** - 认证授权
- **MyBatis-Plus 3.5.14** - ORM
- **MySQL 8.0** - 数据库
- **Redis** - 缓存 + SSE 流式存储
- **Spring WebFlux** - SSE 流式处理

## 项目结构

```
java-backend/
├── src/main/java/com/caius/agent/
│   ├── AgentApplication.java
│   ├── common/                   # 通用模块
│   │   ├── config/               # 配置类
│   │   ├── exception/            # 异常处理
│   │   ├── result/               # 统一返回
│   │   └── util/                 # 工具类
│   ├── module/                   # 业务模块
│   │   ├── agent/                # Agent 流式对话
│   │   │   ├── config/           # AbortManager
│   │   │   ├── controller/       # StreamChatController
│   │   │   ├── service/          # StreamChatService
│   │   │   ├── dto/              # 请求/响应 DTO
│   │   │   └── model/            # SseEvent
│   │   ├── auth/                 # 认证模块
│   │   ├── admin/                # 管理员模块
│   │   ├── conversation/         # 会话模块
│   │   ├── user/                 # 用户模块
│   │   └── gateway/              # Python Agent 网关
│   └── dao/                      # MyBatis Mapper
├── src/main/resources/
│   ├── application.yml
│   ├── application-dev.yml
│   └── application-prod.yml
├── sql/                          # 数据库脚本
├── docs/                         # 文档
│   └── SSE_ABORT_GUIDE.md       # 前端对接指南
└── api.md                        # API 接口文档
```

## 核心功能

### 1. 认证授权
- 用户注册/登录
- JWT Token 生成/验证
- 角色权限控制（USER/ADMIN）

### 2. SSE 流式对话
- 实时流式输出 AI 回复
- Abort 中断机制（智能清理）
- 断线恢复
- Redis Stream 存储优化

### 3. 会话管理
- 创建/查询/删除会话
- 消息历史记录（批量查询优化）
- 最新消息预览

### 4. 管理员功能
- 用户列表（分页+搜索+筛选）
- 用户 CRUD（逻辑删除）
- 状态管理（启用/禁用）

### 5. 用户功能
- 查看/更新用户信息（DTO 转换，隐藏密码）

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
- MySQL 连接信息
- Redis 连接信息
- Python Agent 服务地址

### 3. 启动项目
```bash
mvn spring-boot:run
```

或打包运行：
```bash
mvn clean package -DskipTests
java -jar target/java-backend-0.0.1-SNAPSHOT.jar
```

### 4. 测试账号
- 管理员：`admin / admin123`
- 普通用户：`user / admin123`

## API 接口

### 认证接口
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录

### 用户接口
- `GET /user/{id}` - 获取用户信息（返回 DTO，不含密码）
- `PUT /user/{id}` - 更新用户信息

### SSE 流式对话
- `POST /agent/chat/stream` - 流式对话
- `POST /agent/chat/stream/abort` - 中断流式生成
- `POST /api/v1/chat/{conversationId}/abort` - 中断流式生成（RESTful）
- `GET /agent/chat/stream/recover` - 断线恢复

### 会话管理
- `GET /conversation/list` - 获取会话列表（含最新消息预览）
- `GET /conversation/{id}/messages` - 获取消息列表（含用户名）
- `DELETE /conversation/{id}` - 删除会话（逻辑删除）

### 管理员接口
- `GET /api/admin/users` - 获取用户列表
- `POST /api/admin/users` - 创建用户
- `PUT /api/admin/users/{id}` - 更新用户
- `DELETE /api/admin/users/{id}` - 删除用户（逻辑删除）
- `PATCH /api/admin/users/{id}/toggle-status` - 切换用户状态

**详细 API 文档：** 查看 [api.md](api.md)

## 前端对接

**前端 API 对接文档：** 查看 [docs/frontend-api.md](docs/frontend-api.md)

该文档包含：
- 📋 所有接口的 TypeScript 类型定义
- 🔄 数据结构变更 说明（2026-04-10 更新）
- 💻 完整的前端使用示例
- 📝 迁移指南（从旧版本升级）
- ❓ 常见问题解答

## SSE 流式对接

### 前端快速上手

```typescript
import { fetchEventSource } from '@microsoft/fetch-event-source';

let messageId = null;

fetchEventSource('/agent/chat/stream', {
  method: 'POST',
  body: JSON.stringify({ message: '你好' }),
  onmessage(event) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'done') {
      messageId = data.messageId; // 保存用于 abort
    }
  },
});

// 用户点击停止按钮
async function stopGeneration() {
  await fetch('/agent/chat/stream/abort', {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  });
}
```

**详细对接指南：** 查看 [docs/SSE_ABORT_GUIDE.md](docs/SSE_ABORT_GUIDE.md)

## Abort 机制

### 工作流程
```
用户发送消息 → 后端生成 messageId → SSE 推送 chunk →
done 事件返回 messageId → 用户点击停止 → 调用 abort 接口 →
后端中断流式生成 → 智能清理资源
```

### 核心特性
- ✅ 双重中断（前端 HTTP 中断 + 后端任务中断）
- ✅ 智能清理（防止内存泄漏）
  - 新建会话 + abort → 删除空会话
  - 已有会话 + abort → 保留会话
- ✅ 线程安全（ConcurrentHashMap + AtomicBoolean）
- ✅ 任务超时（默认 10 分钟）
- ✅ Redis Stream 优化（MAXLEN ~ 1000 + TTL）

### 清理策略

| 场景 | 清理内容 |
|------|----------|
| 新建会话 + abort | ✅ 删除 Redis 数据<br>✅ 删除用户消息<br>✅ 删除空会话 |
| 已有会话 + abort | ✅ 删除 Redis 数据<br>✅ 删除用户消息<br>✅ 保留会话 |
| 正常完成 | ✅ 保留所有数据 |

## 性能优化

### 批量查询优化
- ✅ **消息列表**：批量获取用户信息（避免 N+1 查询）
  - 优化前：10 条消息 = 11 次数据库查询
  - 优化后：10 条消息 = 2 次数据库查询
- ✅ **会话列表**：批量获取最新消息预览
  - 优化前：10 个会话 = 11 次数据库查询
  - 优化后：10 个会话 = 2 次数据库查询

### DTO 设计
- ✅ **MessageDTO**：包含用户名，避免前端额外请求
- ✅ **ConversationDTO**：包含最新消息预览
- ✅ **UserDTO**：隐藏密码等敏感信息

### 逻辑删除
- ✅ 使用 MyBatis-Plus `@TableLogic` 自动过滤
- ✅ 用户列表/会话列表/消息列表自动排除已删除数据

## Python Agent 对接

系统通过 HTTP POST 调用 Python Agent 服务：

```yaml
python-agent:
  url: http://localhost:5001
  stream-endpoint: /api/v1/chat/stream
  timeout: 30000
  stream-timeout: 120000
```

## 配置说明

### 流式服务配置
```yaml
streaming:
  max-concurrent: 1000          # 最大并发流（全局）
  per-user-limit: 5             # 单用户最大流数
  max-chunks-per-message: 5000  # 单条消息最大 chunk
  chunk-ttl: 3600               # Redis chunk TTL（秒）
```

## 数据库设计

### 主要表结构
- **user** - 用户表（id, username, email, password, role, status, **deleted**）
- **conversation** - 会话表（id, user_id, title, **deleted**）
- **message** - 消息表（id, conversation_id, user_id, role, content, title, **deleted**）

> 注：所有表都包含 `deleted` 字段用于逻辑删除（0=未删除，1=已删除）

## 测试

```bash
# 运行所有测试
mvn test

# 测试 Abort 功能
./test-abort.sh
```

## 开发工具

- **IDEA** - 推荐 IDE
- **Lombok 插件** - 必需
- **Postman/Insomnia** - API 测试

## 许可证

MIT License
