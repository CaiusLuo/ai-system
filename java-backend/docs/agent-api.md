# Agent API 文档

## Python Agent 流式网关

### 概述

`PythonAgentStreamGateway` 负责与 Python Agent 服务进行流式通信，并将返回的 SSE 事件标准化为前端期望的格式。

### 配置

**配置文件**: `application-{env}.yml`

```yaml
python-agent:
  stream-endpoint: /api/v1/chat/stream  # Python 服务的流式接口端点
```

### 调用协议

#### 请求格式

**方法**: `POST`

**Content-Type**: `application/json`

**Accept**: `text/event-stream`

**请求体**:
```json
{
  "message": "用户消息",
  "session_id": "可选的会话ID",
  "conversation_id": 123,
  "user_id": 456,
  "stream": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | ✅ | 用户消息内容 |
| session_id | string | ❌ | 会话标识 |
| conversation_id | number | ❌ | 对话ID |
| user_id | number | ✅ | 用户ID |
| stream | boolean | ✅ | 固定值 true |

#### 响应格式（Python 返回的原始 SSE）

Python 服务可能返回以下格式：

##### 1. JSON 格式（推荐）

**Chunk 事件**:
```json
{
  "type": "chunk",
  "content": "生成的内容片段",
  "reasoning": "思考过程（可选）",
  "info": "附加信息（可选）",
  "conversation_id": 123
}
```

**Done 事件**:
```json
{
  "type": "done",
  "info": "完成总结",
  "conversation_id": 123
}
```

**Error 事件**:
```json
{
  "type": "error",
  "message": "错误描述"
}
```

**Ping 事件**:
```json
{
  "type": "ping"
}
```

##### 2. SSE 原始格式

```
event: chunk
data: {"content": "..."}

event: done
data: {"info": "..."}
```

##### 3. 纯文本格式

直接返回文本内容，网关会自动包装为 chunk 事件。

---

### 数据标准化

网关会将 Python 返回的原始数据标准化为前端期望的格式：

#### 标准化规则

| Python 返回类型 | 标准化后格式 | 说明 |
|----------------|-------------|------|
| `type: "chunk"` | `{"type":"chunk","content":"...","index":0}` | 内容片段 |
| `type: "message"` | `{"type":"chunk","content":"...","index":0}` | 转换为 chunk |
| `type: "content"` | `{"type":"chunk","content":"...","index":0}` | 转换为 chunk |
| `type: "done"` | `{"type":"done","info":"...","conversationId":123}` | 完成事件 |
| `type: "error"` | `{"type":"error","message":"..."}` | 错误事件 |
| `type: "ping"` | `{"type":"ping"}` | 心跳事件 |

#### 字段映射

**Chunk 事件**:
```json
{
  "type": "chunk",
  "content": "内容",
  "index": 0,
  "reasoning": "思考过程（从 reasoning 或 thinking 字段映射）",
  "info": "附加信息",
  "conversationId": 123
}
```

**Done 事件**:
```json
{
  "type": "done",
  "info": "完成总结（从 info/summary/title/message 字段映射）",
  "conversationId": 123
}
```

---

### Java 接口定义

#### StreamChatService

```java
public interface StreamChatService {
    
    /**
     * 流式对话接口
     * @param userId 用户ID
     * @param request 请求参数
     * @return SseEmitter
     */
    SseEmitter streamChat(Long userId, StreamChatRequest request);
    
    /**
     * 中断流式生成（通过 messageId）
     * @param userId 用户ID
     * @param messageId 消息ID
     * @return 是否成功中断
     */
    boolean abortStream(Long userId, String messageId);
    
    /**
     * 中断流式生成（通过 conversationId）
     * @param userId 用户ID
     * @param conversationId 对话ID
     * @return 是否成功中断
     */
    boolean abortStreamByConversationId(Long userId, Long conversationId);
    
    /**
     * 断线恢复接口
     * @param userId 用户ID
     * @param conversationId 对话ID
     * @param messageId 消息ID
     * @param lastEventId 最后接收的事件ID
     * @param emitter SSE 发射器
     */
    void recoverChunks(Long userId, Long conversationId, String messageId, 
                       String lastEventId, SseEmitter emitter);
}
```

#### PythonAgentStreamGateway

```java
@Component
public class PythonAgentStreamGateway {
    
    /**
     * 流式调用 Python Agent
     * @param requestBody 请求体
     * @return 标准化后的 SseEvent 流
     */
    public Flux<SseEvent> streamChat(Map<String, Object> requestBody);
}
```

---

### 数据模型

#### StreamChatRequest

```java
@Data
@Builder
public class StreamChatRequest {
    @NotBlank
    private String message;        // 用户消息
    private String sessionId;      // 会话ID（可选）
    private Long conversationId;   // 对话ID（可选）
}
```

#### AbortRequest

```java
@Data
@Builder
public class AbortRequest {
    private String messageId;      // 消息ID（UUID）
}
```

#### SseEvent

```java
@Data
@Builder
public class SseEvent {
    private String event;          // 事件类型：chunk/done/error/ping
    private String id;             // 事件ID（用于断线恢复）
    private String data;           // 数据内容（JSON字符串）
}
```

---

### 超时配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `streaming.task-timeout` | 30 分钟 | 任务总超时时间 |
| SSE 空闲超时 | 600 秒（10分钟） | 连接空闲超时时间 |
| 心跳间隔 | 30 秒 | 自动发送 ping 事件间隔 |

---

### 错误处理

#### 常见错误场景

1. **任务超时**
   - 原因：AI 响应超过 30 分钟
   - 处理：自动中断并返回 "任务超时" 错误

2. **连接超时**
   - 原因：10 分钟内无任何数据传输
   - 处理：心跳机制防止误判

3. **客户端断开**
   - 原因：前端主动关闭连接
   - 处理：后端自动清理资源

4. **Python 服务异常**
   - 原因：服务崩溃或网络中断
   - 处理：捕获异常并返回错误事件

#### 错误事件格式

```json
{
  "type": "error",
  "message": "错误描述"
}
```

---

### 日志排查

关键日志关键字：

```bash
# 流式网关日志
grep "\[流式网关\]" logs/app.log

# 流式处理日志
grep "\[流式\]" logs/app.log

# Abort 日志
grep "\[Abort\]" logs/app.log
```

**重要日志说明**：

| 日志内容 | 说明 |
|---------|------|
| `[流式网关] Python 服务流正常结束, 总事件数=N` | Python 服务正常返回 N 个事件 |
| `[流式] 流最终结束, signal=onComplete` | 流正常完成 |
| `[流式] 任务超时触发` | 超过 30 分钟被强制中断 |
| `[流式] SSE 连接超时` | 10 分钟无数据被断开 |
| `[流式] 客户端断开连接` | 前端主动关闭 |
| `[Abort] 中断信号已发送` | 成功触发中断 |

---

### 架构流程

```
前端
  │
  │ POST /agent/chat/stream
  ▼
StreamChatController
  │
  ▼
StreamChatServiceImpl
  │
  │  调用 Python 服务
  ▼
PythonAgentStreamGateway
  │
  │  POST /api/v1/chat/stream
  ▼
Python Agent Service
  │
  │  返回 SSE 流
  ▼
网关标准化 (normalizeSseData)
  │
  ▼
发送到前端 (SseEmitter)
```

---

### 注意事项

1. **事件顺序**：
   - Python 服务返回的事件顺序可能被网络影响
   - 网关按接收顺序转发给前端

2. **内容累积**：
   - Java 层会在内存中累积所有 chunk
   - 用于 done 事件时写入数据库

3. **资源清理**：
   - 任务结束后自动清理 AbortManager 中的标记
   - 防止内存泄漏

4. **并发控制**：
   - 每个用户最多 5 个并发流
   - 超过限制会抛出异常
