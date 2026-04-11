# Agent 服务对接文档

> **Java 后端地址**: `http://localhost:8080`
> **Python Agent 服务**: LangChain + LangGraph + DeepSeek API
> **文档版本**: v1.0
> **更新时间**: 2026-04-10

---

## 架构概览

```
前端 (React + TS)
    ↓ HTTP/SSE
Java 后端 (Spring Boot)
    ↓ HTTP/SSE
Python Agent (LangChain + LangGraph)
    ↓ API 调用
DeepSeek API (支持 think/reasoning)
```

### 数据流说明

1. **前端** → Java 后端：发送用户消息
2. **Java 后端** → Python Agent：转发流式请求
3. **Python Agent** → DeepSeek API：调用 AI 模型（支持 reasoning）
4. **DeepSeek** → Python Agent → Java 后端 → 前端：SSE 流式返回

---

## 1. Python Agent 服务接口

### 1.1 流式对话接口

**POST** `/api/v1/chat/stream`

**调用方**: Java 后端 (`PythonAgentStreamGateway`)

**请求体**:
```typescript
{
  message: string;              // 用户消息内容
  conversation_id?: number;     // 会话 ID（可选）
  session_id?: string;          // 会话标识（可选）
  user_id: number;              // 用户 ID
  stream: true;                 // 固定为 true，启用流式输出
}
```

**响应**: Server-Sent Events (SSE) 流

---

## 2. SSE 事件数据结构（核心）

### 2.1 前端期望的标准化格式

Java 后端的 `PythonAgentStreamGateway` 会将 Python Agent 返回的原始数据**标准化**为以下格式，然后发送给前端：

```typescript
// 所有 SSE 事件的 data 字段均为 JSON 字符串
interface SSEChunkData {
  type: 'chunk' | 'done' | 'error' | 'ping';
  content: string;              // AI 回复内容片段
  index: number;                // 片段索引（从 0 开始）
  reasoning?: string;           // 推理/思考过程（DeepSeek think 模式）
  info?: string;                // 附加信息（如完成提示）
  conversationId?: number;      // 会话 ID（如果 Python 返回了）
}
```

### 2.2 事件类型详解

#### Chunk 事件（AI 内容片段）

**Python Agent 返回格式**（任一即可）:
```json
{
  "type": "chunk",
  "content": "你好",
  "reasoning": "用户打招呼，我应该礼貌回复",
  "conversation_id": 123
}
```

或者：
```json
{
  "type": "message",
  "content": "你好",
  "thinking": "用户打招呼，我应该礼貌回复"
}
```

或者：
```json
{
  "type": "content",
  "content": "你好"
}
```

**Java 后端标准化后发送给前端**:
```json
{
  "type": "chunk",
  "content": "你好",
  "index": 0,
  "reasoning": "用户打招呼，我应该礼貌回复",
  "conversationId": 123
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定为 `"chunk"` |
| content | string | 是 | AI 回复的内容片段 |
| index | number | 是 | 片段索引（后端自动递增） |
| reasoning | string | 否 | DeepSeek 的推理/思考内容 |
| info | string | 否 | 附加信息 |
| conversationId | number | 否 | 会话 ID |

**前端处理**:
```typescript
// 打字机效果显示 content
if (data.type === 'chunk') {
  aiContentRef.current += data.content;
  
  // 如果有 reasoning，可以单独展示
  if (data.reasoning) {
    reasoningContentRef.current += data.reasoning;
  }
  
  setAiContent(aiContentRef.current);
  setReasoningContent(reasoningContentRef.current);
}
```

---

#### Done 事件（对话完成）

**Python Agent 返回格式**（任一即可）:
```json
{
  "type": "done",
  "info": "对话完成",
  "conversation_id": 123
}
```

或者：
```json
{
  "type": "done",
  "summary": "对话完成"
}
```

或者：
```json
{
  "type": "done",
  "title": "对话完成"
}
```

**Java 后端处理后发送给前端**（会自动注入 `messageId`）:
```json
{
  "type": "done",
  "info": "对话完成",
  "conversationId": 123,
  "messageId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定为 `"done"` |
| info | string | 否 | 完成提示信息 |
| conversationId | number | 否 | 会话 ID |
| messageId | string | 是 | ⭐ 消息唯一标识（后端注入，用于 abort） |

**前端处理**:
```typescript
if (data.type === 'done') {
  // ⭐ 保存 messageId（用于后续 abort）
  currentMessageIdRef.current = data.messageId;
  currentConversationIdRef.current = data.conversationId;
  
  console.log('流式对话完成:', {
    messageId: data.messageId,
    conversationId: data.conversationId,
    info: data.info
  });
}
```

---

#### Error 事件（错误）

**Python Agent 返回格式**:
```json
{
  "type": "error",
  "message": "错误信息"
}
```

或者：
```json
{
  "type": "error",
  "error": "错误信息"
}
```

**Java 后端标准化后**:
```json
{
  "type": "error",
  "message": "错误信息",
  "index": 5
}
```

**前端处理**:
```typescript
if (data.type === 'error') {
  showError(data.message);
  setLoading(false);
}
```

---

#### Ping 事件（心跳）

```json
{
  "type": "ping"
}
```

**前端处理**: 忽略或用于检测连接状态

---

## 3. Python Agent 实现规范

### 3.1 LangChain + LangGraph 集成

Python Agent 使用 LangChain 和 LangGraph 构建工作流，需要确保输出符合以下规范：

#### 3.1.1 流式输出格式

```python
from typing import AsyncGenerator
import json

async def chat_stream(message: str, conversation_id: int = None, 
                     session_id: str = None, user_id: int = None):
    """
    流式对话生成器
    
    Yields:
        dict: SSE 事件数据，格式如下：
        
        # Chunk 事件
        {
            "type": "chunk",
            "content": "AI回复的内容片段",
            "reasoning": "推理过程（可选，DeepSeek think模式）"
        }
        
        # Done 事件
        {
            "type": "done",
            "info": "对话完成",
            "conversation_id": 123
        }
        
        # Error 事件
        {
            "type": "error",
            "message": "错误信息"
        }
    """
    
    # 示例：流式输出内容
    async for chunk in llm.astream(message):
        yield {
            "type": "chunk",
            "content": chunk.content,
            "reasoning": chunk.reasoning if hasattr(chunk, 'reasoning') else None
        }
    
    # 完成时发送 done 事件
    yield {
        "type": "done",
        "info": "对话完成",
        "conversation_id": conversation_id
    }
```

#### 3.1.2 支持 DeepSeek Reasoning

DeepSeek API 支持 reasoning/thinking 模式，Python Agent 需要正确提取：

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# 配置 DeepSeek（支持 reasoning）
llm = ChatOpenAI(
    model="deepseek-chat",  # 或 "deepseek-reasoner"
    openai_api_key="your-api-key",
    openai_api_base="https://api.deepseek.com/v1",
    streaming=True
)

async def stream_with_reasoning(message: str):
    """流式输出，包含 reasoning 信息"""
    
    async for chunk in llm.astream([HumanMessage(content=message)]):
        # DeepSeek 返回的 chunk 可能包含：
        # - content: 正常回复内容
        # - reasoning_content: 推理过程（think 模式）
        
        event = {
            "type": "chunk",
            "content": chunk.content if chunk.content else ""
        }
        
        # 如果有 reasoning 内容，单独发送
        if hasattr(chunk, 'reasoning_content') and chunk.reasoning_content:
            event["reasoning"] = chunk.reasoning_content
        
        yield event
    
    yield {
        "type": "done",
        "info": "对话完成"
    }
```

---

### 3.2 LangGraph 工作流示例

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class AgentState(TypedDict):
    """Agent 状态"""
    messages: Annotated[list, operator.add]
    reasoning: str
    response: str

def research_node(state: AgentState) -> dict:
    """研究节点"""
    # 执行搜索/研究
    return {"reasoning": "正在研究用户问题..."}

def response_node(state: AgentState) -> dict:
    """回复节点"""
    # 生成回复
    return {"response": "这是AI的回复"}

# 构建工作流
workflow = StateGraph(AgentState)
workflow.add_node("research", research_node)
workflow.add_node("response", response_node)
workflow.add_edge("research", "response")
workflow.set_entry_point("research")

app = workflow.compile()

async def run_workflow(message: str):
    """执行 LangGraph 工作流"""
    
    initial_state = {
        "messages": [{"role": "user", "content": message}],
        "reasoning": "",
        "response": ""
    }
    
    async for event in app.astream(initial_state):
        # 输出每个节点的状态变化
        for node_name, node_output in event.items():
            if "reasoning" in node_output:
                yield {
                    "type": "chunk",
                    "content": "",
                    "reasoning": node_output["reasoning"]
                }
            
            if "response" in node_output:
                yield {
                    "type": "chunk",
                    "content": node_output["response"]
                }
    
    yield {
        "type": "done",
        "info": "工作流执行完成"
    }
```

---

### 3.3 FastAPI SSE 端点实现

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/api/v1/chat/stream")
async def chat_stream(
    message: str,
    conversation_id: int = None,
    session_id: str = None,
    user_id: int = None
):
    """SSE 流式对话端点"""
    
    async def event_generator():
        try:
            async for event in chat_stream_impl(
                message, conversation_id, session_id, user_id
            ):
                # 格式化为 SSE 格式
                yield f"event: {event['type']}\n"
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            error_event = {
                "type": "error",
                "message": str(e)
            }
            yield f"event: error\n"
            yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用 Nginx 缓冲
        }
    )
```

---

## 4. Java 后端数据处理

### 4.1 请求体构建

Java 后端 (`StreamChatServiceImpl`) 构建请求体发送给 Python Agent：

```java
private Map<String, Object> buildRequestBody(Long userId, StreamChatRequest request, Long conversationId) {
    Map<String, Object> body = new HashMap<>();
    body.put("message", request.getMessage());
    if (request.getSessionId() != null) body.put("session_id", request.getSessionId());
    if (conversationId != null) body.put("conversation_id", conversationId);
    body.put("user_id", userId);
    body.put("stream", true);
    return body;
}
```

### 4.2 数据标准化流程

Python Agent 返回的数据经过 `PythonAgentStreamGateway` 标准化后发送给前端：

```
Python Agent 原始输出
    ↓
normalizeJsonEvent() / normalizeRawEvent()
    ↓
标准化字段（type, content, reasoning, info, conversationId）
    ↓
生成 SSE 事件 ID（type-index）
    ↓
发送给前端
```

**标准化规则**:

| Python 返回字段 | 标准化后字段 | 说明 |
|----------------|-------------|------|
| `type: "message"` | `type: "chunk"` | 统一为 chunk |
| `type: "content"` | `type: "chunk"` | 统一为 chunk |
| `thinking` | `reasoning` | 统一为 reasoning |
| `conversation_id` | `conversationId` | 驼峰命名 |
| `summary` / `title` / `message` | `info` | done 事件的提示信息 |

---

## 5. 前端对接完整示例

### 5.1 TypeScript 类型定义

```typescript
// SSE 事件数据格式
interface SSEChunkData {
  type: 'chunk' | 'done' | 'error' | 'ping';
  content: string;
  index: number;
  reasoning?: string;           // DeepSeek think 模式的推理内容
  info?: string;                // 完成提示/附加信息
  conversationId?: number;      // 会话 ID
  messageId?: string;           // 消息 ID（done 事件中由后端注入）
}

// 流式对话状态
interface StreamingState {
  isStreaming: boolean;
  content: string;              // AI 回复的完整内容
  reasoning: string;            // 推理过程（可选）
  conversationId: number | null;
  messageId: string | null;
  error: string | null;
}
```

### 5.2 React Hook 实现

```typescript
import { useState, useRef, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';

interface UseStreamingChatOptions {
  onChunk?: (content: string, reasoning?: string) => void;
  onDone?: (conversationId: number, messageId: string) => void;
  onError?: (error: string) => void;
}

export function useStreamingChat(options?: UseStreamingChatOptions) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    reasoning: '',
    conversationId: null,
    messageId: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');
  const reasoningRef = useRef('');

  const startStreaming = useCallback(async (
    message: string,
    conversationId?: number
  ) => {
    setState(prev => ({
      ...prev,
      isStreaming: true,
      error: null,
      content: '',
      reasoning: '',
    }));

    contentRef.current = '';
    reasoningRef.current = '';

    try {
      await fetchEventSource('/agent/chat/stream', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
        }),

        onmessage(event) {
          const data: SSEChunkData = JSON.parse(event.data);

          switch (data.type) {
            case 'chunk':
              contentRef.current += data.content;
              if (data.reasoning) {
                reasoningRef.current += data.reasoning;
              }

              setState(prev => ({
                ...prev,
                content: contentRef.current,
                reasoning: reasoningRef.current,
              }));

              options?.onChunk?.(data.content, data.reasoning);
              break;

            case 'done':
              setState(prev => ({
                ...prev,
                isStreaming: false,
                conversationId: data.conversationId ?? prev.conversationId,
                messageId: data.messageId ?? null,
              }));

              if (data.conversationId && data.messageId) {
                options?.onDone?.(data.conversationId, data.messageId);
              }
              break;

            case 'error':
              setState(prev => ({
                ...prev,
                isStreaming: false,
                error: data.message,
              }));

              options?.onError?.(data.message);
              break;

            case 'ping':
              // 心跳，忽略
              break;
          }
        },

        onerror(error) {
          console.error('SSE 错误:', error);
          setState(prev => ({
            ...prev,
            isStreaming: false,
            error: '连接异常',
          }));
          options?.onError?.('连接异常');
          throw error; // 停止重连
        },

        openWhenHidden: true, // 页面隐藏时保持连接
      });
    } catch (error) {
      console.error('流式对话失败:', error);
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: '请求失败',
      }));
    }
  }, [options]);

  const abortStreaming = useCallback(async () => {
    if (!state.messageId) {
      console.warn('没有活跃的流式任务');
      return;
    }

    try {
      const response = await fetch('/agent/chat/stream/abort', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId: state.messageId }),
      });

      const result = await response.json();

      if (result.data) {
        console.log('流式生成已中断');
        setState(prev => ({
          ...prev,
          isStreaming: false,
          messageId: null,
        }));
      }
    } catch (error) {
      console.error('中断失败:', error);
    }
  }, [state.messageId]);

  return {
    state,
    startStreaming,
    abortStreaming,
  };
}
```

### 5.3 React 组件使用示例

```tsx
import { useState } from 'react';
import { useStreamingChat } from './useStreamingChat';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
  }>>([]);

  const { state, startStreaming, abortStreaming } = useStreamingChat({
    onChunk: (content, reasoning) => {
      // 实时更新最后一条 AI 消息
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += content;
          if (reasoning) {
            lastMsg.reasoning = (lastMsg.reasoning || '') + reasoning;
          }
        }
        return updated;
      });
    },
    onDone: (conversationId, messageId) => {
      console.log('对话完成:', { conversationId, messageId });
    },
    onError: (error) => {
      console.error('错误:', error);
    },
  });

  const handleSend = async () => {
    if (!input.trim() || state.isStreaming) return;

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    
    // 添加 AI 占位消息
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    // 开始流式对话
    await startStreaming(input, state.conversationId ?? undefined);
    setInput('');
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.role === 'assistant' && msg.reasoning && (
              <details className="reasoning-block">
                <summary>推理过程</summary>
                <pre>{msg.reasoning}</pre>
              </details>
            )}
            <div className="content">{msg.content}</div>
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          disabled={state.isStreaming}
        />
        
        {state.isStreaming ? (
          <button onClick={abortStreaming}>停止生成</button>
        ) : (
          <button onClick={handleSend}>发送</button>
        )}
      </div>

      {state.error && <div className="error">{state.error}</div>}
    </div>
  );
}
```

---

## 6. 错误处理

### 6.1 常见错误场景

| 场景 | 前端表现 | 后端处理 |
|------|---------|---------|
| Python Agent 服务不可用 | SSE 连接失败 | 返回错误日志 |
| DeepSeek API 超时 | 显示错误信息 | 触发 error 事件 |
| 网络中断 | SSE 断开 | 前端需重连 |
| Abort 中断 | 停止生成 | 清理中间数据 |
| 并发流数超限 | 返回 429 | 抛出异常 |

### 6.2 前端错误处理

```typescript
// 全局错误处理
function handleSSEError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('429')) {
      showToast('并发请求过多，请稍后重试');
    } else if (error.message.includes('401')) {
      redirectToLogin();
    } else if (error.message.includes('500')) {
      showToast('服务异常，请稍后重试');
    } else {
      showToast('网络异常');
    }
  }
}
```

---

## 7. 性能优化建议

### 7.1 Python Agent 端

1. **流式输出**: 使用 `astream()` 而非 `ainvoke()`
2. **缓冲控制**: 避免一次输出过大的 chunk（建议 10-50 字符）
3. **超时设置**: DeepSeek API 调用设置合理超时（如 60s）
4. **连接池**: 复用 HTTP 连接

```python
# 推荐：控制 chunk 大小
async for chunk in llm.astream(message):
    if len(chunk.content) > 50:
        # 分割大块
        for i in range(0, len(chunk.content), 50):
            yield {
                "type": "chunk",
                "content": chunk.content[i:i+50]
            }
    else:
        yield {
            "type": "chunk",
            "content": chunk.content
        }
```

### 7.2 Java 后端

1. **并发控制**: 单用户最多 5 个并发流（可配置）
2. **超时设置**: 任务超时 10 分钟（可配置）
3. **Redis 缓存**: chunk 数据缓存 1 小时
4. **异步存储**: done 事件触发异步批量存储

### 7.3 前端

1. **打字机效果**: 使用 `requestAnimationFrame` 优化渲染
2. **虚拟列表**: 长消息列表使用虚拟滚动
3. **防抖节流**: 频繁更新使用节流

---

## 8. 配置说明

### 8.1 Java 后端配置（application.yml）

```yaml
streaming:
  max-concurrent: 1000          # 全局最大并发流
  per-user-limit: 5             # 单用户最大流数
  max-chunks-per-message: 5000  # 单条消息最大 chunk
  chunk-ttl: 3600               # Redis chunk TTL（秒）
  task-timeout: 10              # 任务超时（分钟）

python-agent:
  url: http://localhost:5001
  stream-endpoint: /api/v1/chat/stream
```

### 8.2 Python Agent 环境变量

```bash
# DeepSeek API 配置
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_API_BASE=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat  # 或 deepseek-reasoner

# 服务配置
AGENT_HOST=0.0.0.0
AGENT_PORT=5001
```

---

## 9. 调试技巧

### 9.1 查看 Java 后端日志

```bash
# 查看流式请求日志
tail -f logs/app.log | grep "\[流式\]"

# 查看 Abort 日志
tail -f logs/app.log | grep "\[Abort\]"
```

### 9.2 查看 Python Agent 日志

```bash
# 查看 FastAPI 日志
tail -f logs/agent.log
```

### 9.3 测试 Python Agent 直接输出

```bash
curl -X POST http://localhost:5001/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "你好", "user_id": 1, "stream": true}'
```

---

## 10. 数据流完整示例

### 10.1 正常对话流程

```
1. 前端发送请求
   POST /agent/chat/stream
   Body: { "message": "解释一下量子纠缠", "conversationId": 123 }

2. Java 后端处理
   - 生成 messageId: "550e8400-..."
   - 创建 Abort 标记
   - 创建用户消息（MySQL）
   - 调用 Python Agent

3. Python Agent 返回
   event: chunk
   data: {"type": "chunk", "content": "量子纠缠是", "reasoning": "用户问物理概念"}
   
   event: chunk
   data: {"type": "chunk", "content": "一种量子力学现象"}
   
   event: done
   data: {"type": "done", "info": "解释完成"}

4. Java 后端标准化后发送给前端
   event: chunk
   id: chunk-0
   data: {"type":"chunk","content":"量子纠缠是","index":0,"reasoning":"用户问物理概念"}
   
   event: chunk
   id: chunk-1
   data: {"type":"chunk","content":"一种量子力学现象","index":1}
   
   event: done
   id: done-2
   data: {"type":"done","info":"解释完成","conversationId":123,"messageId":"550e8400-..."}

5. 前端接收并显示
   - 打字机效果显示 content
   - 展开 reasoning（如果有）
   - done 事件保存 messageId
```

### 10.2 Abort 中断流程

```
1. 用户点击"停止生成"
   前端调用: POST /agent/chat/stream/abort
   Body: { "messageId": "550e8400-..." }

2. Java 后端处理
   - 设置 Abort 标记
   - 下次检查时触发中断

3. 清理操作
   - 删除 Redis 中的 chunk 数据
   - 删除用户消息（MySQL）
   - 如果是新会话，删除空会话
   - 清理 Abort 标记

4. 前端收到 error 事件
   data: {"type":"error","message":"流式生成已中断"}
```

---

## 11. 常见问题

### Q1: Python Agent 返回的格式不符合要求怎么办？

**A**: Java 后端的 `PythonAgentStreamGateway` 会自动标准化数据。只要 Python Agent 返回的是 JSON 格式，后端会自动转换字段名（如 `thinking` → `reasoning`，`conversation_id` → `conversationId`）。

### Q2: DeepSeek 的 reasoning 内容如何传递给前端？

**A**: Python Agent 在 chunk 事件中包含 `reasoning` 或 `thinking` 字段，Java 后端会统一标准化为 `reasoning` 字段传递给前端。

```python
# Python Agent 示例
yield {
    "type": "chunk",
    "content": "回复内容",
    "reasoning": "这是推理过程"  # 或使用 "thinking"
}
```

### Q3: 如何实现断线恢复？

**A**: 使用 `GET /agent/chat/stream/recover?conversationId=123&messageId=xxx&lastEventId=chunk-5`

- `conversationId`: 会话 ID
- `messageId`: 从 done 事件中获取
- `lastEventId`: 最后接收到的事件 ID

### Q4: Abort 后前端需要做什么清理？

**A**: 
1. 清除 `currentMessageId` 状态
2. 显示"已中断"提示
3. 后端会自动清理中间数据（Redis、MySQL）

### Q5: Python Agent 如何支持多轮对话？

**A**: Python Agent 需要维护对话历史。Java 后端会在请求中传递 `conversation_id`，Python Agent 可以根据此 ID 从数据库加载历史消息。

```python
# Python Agent 加载历史消息
def get_conversation_history(conversation_id: int):
    # 从数据库或缓存加载
    return [
        {"role": "user", "content": "历史消息1"},
        {"role": "assistant", "content": "历史回复1"},
    ]

async def chat_stream(message: str, conversation_id: int = None):
    history = get_conversation_history(conversation_id) if conversation_id else []
    
    messages = history + [{"role": "user", "content": message}]
    
    async for chunk in llm.astream(messages):
        yield {"type": "chunk", "content": chunk.content}
```

---

**文档版本**: v1.0  
**更新日期**: 2026-04-10  
**维护者**: 后端团队  

如有疑问，请联系后端开发团队。
