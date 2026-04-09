# Job Agent - 求职Agent API

基于 FastAPI + LangGraph + LangChain + DeepSeek 的企业级求职Agent服务

## 架构设计

采用 Clean Architecture 分层架构，实现依赖倒置和关注点分离：

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (api/)                      │
│  - HTTP 路由、请求校验、响应格式化                        │
│  - 依赖注入获取应用服务                                   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                Application Layer (application/)          │
│  - Agent 工作流编排（LangGraph）                          │
│  - 业务逻辑、节点定义                                     │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐        ┌──────────────────────────┐
│  Domain Layer    │        │  Infrastructure Layer     │
│  (domain/)       │        │  (infrastructure/)        │
│  - 实体定义      │◄──────►│  - LLM 服务实现            │
│  - 协议接口      │        │  - 外部系统客户端           │
│  - 值对象        │        └──────────────────────────┘
└──────────────────┘
```

## 目录结构

```
agent-python/
├── agent/                          # 主包
│   ├── api/v1/                     # 接口层 - HTTP 路由
│   │   ├── chat.py                 #   聊天接口
│   │   ├── health.py               #   健康检查
│   │   └── router.py               #   路由聚合
│   │
│   ├── application/agent/          # 应用层 - 业务逻辑
│   │   ├── graph.py                #   LangGraph 图编排
│   │   └── nodes.py                #   节点工厂函数
│   │
│   ├── domain/                     # 领域层 - 核心定义
│   │   ├── entities.py             #   实体（Message, AgentState）
│   │   ├── protocols.py            #   协议接口（Repository, Gateway）
│   │   └── values.py               #   值对象
│   │
│   ├── infrastructure/             # 基础设施层 - 外部服务
│   │   ├── llm/
│   │   │   └── deepseek_service.py #   DeepSeek LLM 服务
│   │   └── external/
│   │       └── java_backend_client.py # Java 后端客户端
│   │
│   ├── core/                       # 核心层 - 横切关注点
│   │   ├── config.py               #   配置管理
│   │   ├── exceptions.py           #   异常定义
│   │   ├── logging.py              #   日志配置
│   │   ├── middleware.py           #   中间件
│   │   └── sse.py                  #   SSE 格式化工具
│   │
│   ├── schemas/                    # 数据模型层
│   │   └── chat.py                 #   请求/响应模型
│   │
│   ├── prompts/                    # Prompt 配置
│   │   └── system.py               #   系统提示词
│   │
│   ├── main.py                     # 应用入口
│   └── __init__.py
│
├── static/                         # 静态文件
│   └── stream-test.html            # 流式测试页面
├── pyproject.toml                  # 项目配置（依赖声明）
├── .env.example                    # 环境变量示例
└── README.md
```

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入真实的 DEEPSEEK_API_KEY
```

### 2. 安装依赖

```bash
uv sync
```

### 3. 启动服务

```bash
# 方式1：直接运行 main.py（推荐）
uv run python main.py

# 方式2：使用 uvicorn 模块
uv run uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

### 4. 测试接口

```bash
# 健康检查
curl http://localhost:5000/api/v1/health

# 聊天接口（无需 Java 后端即可测试）
curl -X POST http://localhost:5000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "我想准备后端开发面试",
    "conversation_id": 1,
    "token": "your_jwt_token"
  }'
```

### 5. API 文档

启动后访问 `http://localhost:5000/docs` 查看 Swagger UI

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/ready` | 就绪检查 |
| POST | `/api/v1/chat` | 聊天接口（非流式） |
| POST | `/api/v1/chat/stream` | 聊天接口（SSE 流式） |
| GET | `/static/stream-test.html` | 流式测试页面 |

## 流式输出（SSE）

### SSE 数据格式

```
event: message
id: 0
data: {"type":"chunk","content":"你好","index":0,"timestamp":1712649600,"conversation_id":1}

event: message
id: 1
data: {"type":"chunk","content":"，我","index":1,"timestamp":1712649601,"conversation_id":1}

event: done
id: final
data: {"type":"done","content":"","conversation_id":1,"total_tokens":50,"timestamp":1712649610}
```

### 测试方式

**1. curl 测试：**
```bash
curl -N -X POST http://localhost:5000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好",
    "conversation_id": 1,
    "token": "your_jwt_token"
  }'
```

**2. 浏览器测试：**
访问 `http://localhost:5000/static/stream-test.html` 使用内置测试页面

**3. 前端集成示例（fetch + ReadableStream）：**
```javascript
const response = await fetch('/api/v1/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '你好', conversation_id: 1, token: 'xxx' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const messages = buffer.split('\n\n');
  buffer = messages.pop();

  for (const msg of messages) {
    const data = JSON.parse(msg.split('\n').find(l => l.startsWith('data: '))?.slice(6));
    if (data?.type === 'chunk') {
      // 实时追加显示
      document.getElementById('output').textContent += data.content;
    }
  }
}
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| DEEPSEEK_API_KEY | 是 | DeepSeek API Key |
| DEEPSEEK_BASE_URL | 是 | DeepSeek API 地址 |
| DEEPSEEK_MODEL | 否 | 模型名称（默认 deepseek-chat）|
| JAVA_BACKEND_URL | 否 | Java 后端地址（不填则跳过历史获取）|
| LANGSMITH_API_KEY | 否 | LangSmith API Key |
| LANGSMITH_TRACING | 否 | 是否启用 LangSmith 追踪 |

## 架构特点

- **Clean Architecture**：分层清晰，依赖方向由外向内
- **依赖倒置**：通过 Protocol 接口实现服务解耦
- **依赖注入**：FastAPI Depends + 应用状态容器
- **结构化日志**：请求追踪（X-Request-ID）、耗时统计
- **全局异常处理**：统一错误响应格式
- **SSE 流式输出**：真正的逐 chunk 推送，非静默等待
- **Python 3.9+**：完全兼容
