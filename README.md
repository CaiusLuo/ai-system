# AI System MVP

这是一个已经在本地跑通的三段式求职 Agent MVP，由以下三个服务组成：

- `agent-frontend`：前端交互层，负责登录注册、会话展示、流式聊天体验、管理后台入口。
- `java-backend`：业务后端，负责用户认证、会话与消息存储、权限控制、SSE 转发与中断控制。
- `agent-python`：Agent 执行层，负责 Prompt、LLM 调用、流式生成、LangGraph 编排。

当前 MVP 的核心定位不是“全自动投递平台”，而是“可对话、可追踪、可持续扩展的求职助手基础设施”。

## 1. MVP 架构总览

### 1.1 分层关系

```text
Browser
  |
  v
agent-frontend (React + Vite)
  |
  v
java-backend (Spring Boot)
  | \
  |  \__ MySQL: 用户 / 会话 / 消息持久化
  |__ Redis: 流式过程态 / chunk 恢复 / 并发控制辅助
  |
  v
agent-python (FastAPI + LangGraph + DeepSeek)
  |
  v
LLM Provider
```

### 1.2 当前实际职责

#### `agent-frontend`

- 基于 React 19 + TypeScript + Vite。
- 提供落地页、登录注册页、聊天页、管理后台页。
- 通过 `fetch + ReadableStream` 消费 SSE 流，而不是依赖浏览器原生 `EventSource`。
- 本地维护会话缓存，提升切换会话和刷新后的体验。
- 通过 Vite Proxy 将 `/agent`、`/auth`、`/conversation`、`/user`、`/api` 转发到 Java 后端。

#### `java-backend`

- 基于 Spring Boot 3 + Spring Security + MyBatis-Plus + Redis。
- 承担系统主后端职责：
  - 用户注册、登录、JWT 鉴权
  - 用户信息与管理后台能力
  - 会话列表、消息列表、删除会话
  - 对 Python Agent 做统一网关封装
  - 对前端输出标准化 SSE 事件
  - 流式中断、超时、并发限制、恢复支持
- 数据存储以 MySQL 为主，流式临时状态与恢复能力依赖 Redis。

#### `agent-python`

- 基于 FastAPI + LangGraph + LangChain。
- 当前核心功能：
  - 接收聊天请求
  - 构建系统 Prompt
  - 调用 DeepSeek 模型
  - 输出 token 级流式内容
  - 支持 abort 中断检查
- 代码结构已经按分层整理：
  - `api/`：HTTP 路由
  - `application/`：Agent 编排
  - `domain/`：领域协议与实体
  - `infrastructure/`：Java 后端客户端、LLM 网关
  - `core/`：配置、日志、中断、SSE 工具
  - `prompts/`：系统提示词

## 2. 当前主流程

### 2.1 登录与进入系统

1. 用户在前端访问首页。
2. 未登录时进入 `LandingPage` / `AuthPage`。
3. 前端调用 Java 后端 `/auth/login` 或 `/auth/register`。
4. 登录成功后，前端将 token 和用户信息写入本地存储。
5. 用户进入 `/chat` 页面开始对话。

### 2.2 流式对话链路

1. 前端在 `ChatPage` 中调用 `useSSEChat`。
2. 前端向 Java 后端发起 `POST /agent/chat/stream`。
3. Java 后端：
   - 校验用户身份
   - 获取或创建会话
   - 生成 `messageId`
   - 将请求转发给 Python Agent
4. Python Agent 接收请求后：
   - 组装 system prompt + user message
   - 调用 DeepSeek 流式生成
   - 逐 chunk 返回 SSE 数据
5. Java 后端网关将 Python 返回的数据标准化为前端统一格式：
   - `chunk`
   - `done`
   - `error`
   - `ping`
6. 前端实时渲染输出中的内容与 reasoning。
7. 流完成后，Java 后端异步持久化用户消息与 AI 消息。

### 2.3 中断与恢复

当前 MVP 已经不是单纯“能聊天”，而是包含了比较关键的工程能力：

- 支持 `abort` 中断流式生成
- 支持按 `conversationId` / `messageId` 定位流任务
- 支持超时与并发数限制
- 支持 Redis 参与流式恢复与 chunk 管理

这意味着你的 MVP 已经具备“生产化对话链路雏形”，而不是 demo 级单轮问答。

## 3. 关键接口边界

### 3.1 前端到 Java 后端

- `POST /auth/login`
- `POST /auth/register`
- `GET /conversation/list`
- `GET /conversation/{id}/messages`
- `DELETE /conversation/{id}`
- `POST /agent/chat/stream`
- `POST /agent/chat/stream/abort`
- `GET /agent/chat/stream/recover`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/{id}`
- `DELETE /api/admin/users/{id}`

### 3.2 Java 后端到 Python Agent

当前主要通过 Python Agent 的流式接口完成核心能力对接：

- `POST /api/v1/chat/stream`
- `POST /api/v1/chat/stream/abort`
- `GET /api/v1/health`

### 3.3 SSE 事件模型

Java 后端对 Python Agent 的输出做了标准化，前端消费的是统一事件格式：

```json
{
  "type": "chunk",
  "content": "本段回复内容",
  "index": 0,
  "reasoning": "可选的思考内容",
  "conversationId": 123,
  "messageId": "uuid"
}
```

完成态、错误态和心跳态也都被统一处理，所以前端实现可以保持比较稳定。

## 4. 数据模型

当前数据库核心实体有三类：

- `user`
  - 用户名、邮箱、密码、角色、状态
- `conversation`
  - 会话归属、标题、创建/更新时间
- `message`
  - 会话 ID、用户 ID、角色、内容、标题、时间

这套模型适合支撑当前 MVP 的“用户体系 + 会话历史 + 多轮对话”。

## 5. 为什么这个架构适合做 MVP

### 5.1 优点

- 前后端与 Agent 解耦，后续替换模型或 Agent 框架成本较低。
- Java 后端把鉴权、会话、存储、SSE 管理收拢，系统边界清晰。
- Python Agent 单独演进 Prompt、工具调用、工作流，不影响主站认证和数据层。
- 前端已经具备流式体验和本地缓存，用户感知比较完整。

### 5.2 当前边界

这个 MVP 现在更像：

- 一个“求职对话系统”
- 一个“后续可接工具和工作流的 Agent 平台雏形”

它还不是：

- 全自动投递系统
- 复杂多工具自治 Agent 平台
- 具备文档解析、浏览器自动操作、PPT 生成闭环的平台

## 6. 本地运行关系

你现在的本地链路可以理解为：

1. 启动 `agent-python`，默认监听 `5001`
2. 启动 `java-backend`，默认监听 `8080`
3. 启动 `agent-frontend`
4. 前端所有业务请求先到 Java 后端
5. Java 后端再把 Agent 请求转发到 Python

其中：

- 前端代理目标是 `http://localhost:8080`
- Java 后端配置的 Python Agent 地址是 `http://localhost:5001`

## 7. 当前 MVP 最适合展示的能力

如果你要对外介绍这个项目，最值得强调的是这几个点：

- 三段式架构：前端、业务后端、Agent 执行层解耦
- 支持登录注册、权限控制、用户管理
- 支持多轮会话、历史消息查询与删除
- 支持 SSE 流式输出与前端实时渲染
- 支持中断生成、并发限制、恢复机制
- Agent 端已按可扩展分层设计，适合后续接入工具调用

## 8. 现阶段一句话定义

这是一个“本地已跑通的求职 Agent MVP”，已经完成了从用户进入系统、发起对话、流式生成、消息持久化到会话管理的闭环，并为后续扩展职位抓取、简历优化、岗位匹配和工具调度预留了清晰边界。
