# Agent Python 服务

> LangChain + LangGraph + DeepSeek API 实现的智能 Agent 服务
> 对接 Java 后端（Spring Boot）和前端（React + TypeScript）

## 架构概览

```
前端 (React + TS)
    ↓ HTTP/SSE
Java 后端 (Spring Boot)
    ↓ HTTP/SSE
Python Agent (LangChain + LangGraph)  ← 本项目
    ↓ API 调用
DeepSeek API (支持 think/reasoning)
```

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI + uvicorn |
| Agent 编排 | LangGraph (`StateGraph`) |
| LLM 客户端 | LangChain (`ChatOpenAI` via OpenAI 兼容接口) |
| LLM 提供商 | DeepSeek |
| 流式协议 | SSE (Server-Sent Events) |
| 中断控制 | `asyncio.Event` 内存标志 |
| 外部通信 | `httpx.AsyncClient` |
| 配置管理 | `pydantic-settings` |
| 依赖管理 | `uv` (pyproject.toml) |
| Python 版本 | 3.12.2 |

## 快速开始

### 1. 环境准备

```bash
# 安装 uv（Python 包管理器）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 安装并使用 Python 3.12.2
uv python install 3.12.2

# 安装依赖
uv sync --python 3.12.2
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入必要的配置
vim .env
```

关键配置项：
```env
# LLM 配置（必填）
DEEPSEEK_API_KEY=your-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# 外部服务（可选）
JAVA_BACKEND_URL=http://localhost:8080
```

### 3. 启动服务

```bash
# 开发模式（自动重载）
uv run python main.py

# 或使用 uvicorn 直接启动
uv run uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

服务启动后访问：
- API 文档：http://localhost:5001/docs
- ReDoc 文档：http://localhost:5001/redoc
- 健康检查：http://localhost:5001/api/v1/health

## API 接口

### 1. 流式对话接口（核心）

**POST** `/api/v1/chat/stream`

请求体：
```json
{
  "message": "解释一下量子纠缠",
  "conversation_id": 123,
  "session_id": "optional-session-id",
  "user_id": 1,
  "stream": true
}
```

响应：Server-Sent Events (SSE) 流

SSE 事件格式：
```
event: chunk
id: chunk-0
data: {"type":"chunk","content":"量子纠缠是","index":0,"reasoning":"用户问物理概念"}

event: chunk
id: chunk-1
data: {"type":"chunk","content":"一种量子力学现象","index":1}

event: done
id: done
data: {"type":"done","info":"对话完成","conversation_id":123}
```

### 2. 中断流式生成

**POST** `/api/v1/chat/stream/abort`

请求体：
```json
{
  "message_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. 非流式对话接口

**POST** `/api/v1/chat`

请求体：
```json
{
  "message": "你好",
  "user_id": 1,
  "conversation_id": 0,
  "stream": false
}
```

响应：
```json
{
  "reply": "你好！有什么我可以帮助你的吗？",
  "conversation_id": 0
}
```

### 4. 健康检查

**GET** `/api/v1/health`
**GET** `/api/v1/ready`

## 项目结构

```
agent-python/
├── main.py                          # FastAPI 应用入口
├── pyproject.toml                   # 项目依赖配置
├── .env                             # 环境变量（不提交）
├── .env.example                     # 环境变量模板
├── README.md                        # 项目文档
└── agent/
    ├── api/                         # 接口层（HTTP 路由）
    │   └── v1/
    │       ├── router.py            # 路由聚合器
    │       ├── health.py            # 健康检查路由
    │       └── chat.py              # 聊天路由（SSE + Abort）
    ├── application/                 # 应用层（业务逻辑/Agent 编排）
    │   └── agent/
    │       ├── graph.py             # LangGraph 工作流编排
    │       └── nodes.py             # Agent 节点定义
    ├── core/                        # 核心层（配置/异常/中间件）
    │   ├── config.py                # Pydantic Settings
    │   ├── exceptions.py            # 业务异常定义
    │   ├── logging.py               # 结构化日志配置
    │   ├── middleware.py            # 请求日志/CORS 中间件
    │   ├── sse.py                   # SSE 格式化工具
    │   ├── abort.py                 # 中断控制器
    │   └── retry.py                 # 重试机制工具
    ├── domain/                      # 领域层（实体/协议定义）
    │   ├── entities.py              # TypedDict 实体
    │   ├── protocols.py             # Protocol 接口契约
    │   └── values.py                # 枚举值对象
    ├── infrastructure/              # 基础设施层（外部服务客户端）
    │   ├── external/
    │   │   └── java_backend_client.py  # Java 后端 HTTP 客户端
    │   └── llm/
    │       └── deepseek_service.py     # DeepSeek LLM 服务
    ├── prompts/                     # Prompt 配置层
    │   └── system.py                # 系统提示词
    ├── schemas/                     # 数据模型层
    │   └── chat.py                  # Pydantic 请求/响应模型
    └── tools/                       # 工具目录（预留）
```

## 核心特性

### 1. SSE 流式输出

支持 token 级别的流式输出，使用 FastAPI 的 `StreamingResponse` 实现 SSE 协议。

```python
# SSE 事件类型
- chunk: AI 内容片段（含 reasoning 可选）
- done: 对话完成
- error: 错误信息
- ping: 心跳（每 15 秒自动发送）
```

### 2. DeepSeek Reasoning 支持

自动提取 DeepSeek 的 thinking/reasoning_content 内容：

```python
# chunk 事件可包含
{
    "type": "chunk",
    "content": "回复内容",
    "reasoning": "推理过程"  # 可选，来自 DeepSeek think 模式
}
```

### 3. 中断机制

使用 `asyncio.Event` 实现轻量级中断：
- 前端调用 `/api/v1/chat/stream/abort` 发送中断请求
- Python Agent 在每个 chunk 检查中断标志
- 检测到中断后立即停止生成并清理资源

### 4. 重试机制

LLM 调用内置指数退避重试策略：
- 默认重试 3 次
- 指数退避：1s → 2s → 4s
- 添加随机抖动避免惊群效应
- 可配置最大延迟 30 秒

### 5. 企业级特性

- **请求追踪**：每个请求分配唯一 Request ID
- **结构化日志**：JSON 格式日志，便于 ELK 采集
- **CORS 支持**：可配置允许的域名
- **异常处理**：完善的异常分类和错误码
- **配置管理**：基于 pydantic-settings 的类型安全配置
- **性能监控**：请求耗时统计和响应时间追踪

## 对接文档

详细的前后端对接文档见：[Agent 服务对接文档](./docs/integration-guide.md)

关键对接点：
- SSE 事件格式已标准化（chunk/done/error/ping）
- 请求体格式匹配文档规范（message, conversation_id, session_id, user_id, stream）
- Abort 端点路径：`/api/v1/chat/stream/abort`
- Reasoning 内容自动提取并传递给前端

## 开发指南

### 添加新工具

在 `agent/tools/` 目录下创建工具函数：

```python
# agent/tools/weather.py
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """获取指定城市的天气信息"""
    # 实现天气查询逻辑
    return f"{city}的天气是晴天"
```

然后在 `graph.py` 中注册工具。

### 自定义 Prompt

编辑 `agent/prompts/system.py` 修改系统提示词：

```python
SYSTEM_PROMPT = """
你是专业的求职助手，擅长：
1. 分析用户优势
2. 优化简历
3. 提供面试建议
4. 规划职业发展
"""
```

### 扩展 LangGraph 节点

在 `agent/application/agent/nodes.py` 添加新节点：

```python
def create_custom_node(service: SomeService):
    async def custom_node(state: AgentState) -> dict:
        # 实现节点逻辑
        return {"result": "处理结果"}
    return custom_node
```

然后在 `graph.py` 中注册节点。

## 测试

```bash
# 运行测试（待实现）
uv run pytest

# 测试流式接口
curl -X POST http://localhost:5001/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "你好", "user_id": 1, "stream": true}'
```

## 部署

### Docker 部署（推荐）

```dockerfile
FROM python:3.12.2-slim

WORKDIR /app
COPY . .

RUN pip install uv
RUN uv sync --frozen --python 3.12.2

EXPOSE 5001

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]
```

### 生产环境配置

```env
DEBUG=false
LLM_TIMEOUT=60.0
LLM_MAX_RETRIES=3
CORS_ALLOW_ORIGINS=https://your-frontend-domain.com
```

## 性能优化

1. **流式输出**：使用 `astream()` 而非 `ainvoke()`
2. **缓冲控制**：自动分割大块内容（建议 10-50 字符/chunk）
3. **连接池**：复用 HTTP 连接
4. **超时设置**：LLM 调用 60s，流式任务 10 分钟
5. **并发控制**：单用户最多 5 个并发流

## 常见问题

### Q: 如何查看推理过程（reasoning）？

A: 在 SSE chunk 事件中，如果有 `reasoning` 字段，说明 DeepSeek 正在输出推理过程。前端可以单独展示或隐藏这部分内容。

### Q: 中断后如何恢复？

A: 中断后无法恢复。需要重新发起请求。后端会自动清理中间数据。

### Q: 如何切换 DeepSeek 模型？

A: 修改 `.env` 文件中的 `DEEPSEEK_MODEL` 环境变量：
```env
DEEPSEEK_MODEL=deepseek-chat      # 标准模型
DEEPSEEK_MODEL=deepseek-reasoner  # 推理模型（支持 think 模式）
```

## 许可证

[MIT License](LICENSE)
