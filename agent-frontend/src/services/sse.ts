import { getToken } from './auth';

// SSE 事件类型定义
export interface SSEChunkData {
  type: 'chunk';
  content: string;
  index: number;
  conversationId?: number; // 首次响应可能包含 conversationId
}

export interface SEDoneData {
  type: 'done';
  total_tokens: number;
}

export interface SEEErrorData {
  type: 'error';
  message: string;
}

export interface SEPingData {
  type: 'ping';
}

export type SSEEventData = SSEChunkData | SEDoneData | SEEErrorData | SEPingData;

// SSE 回调类型
export type SSEHandlers = {
  onChunk?: (content: string, index: number) => void;
  onDone?: (data: SEDoneData) => void;
  onError?: (error: SEEErrorData) => void;
  onConversationId?: (conversationId: number) => void; // 新增：提取 conversationId
};

/**
 * 解析 SSE 数据块
 * 支持格式：
 * - data: {"type": "chunk", "content": "hello"}
 * - data: {"type": "done", "total_tokens": 100}
 * - data: {"type": "error", "message": "error"}
 */
function parseSSEChunk(text: string): SSEEventData | null {
  const trimmed = text.trim();
  if (!trimmed || !trimmed.startsWith('data: ')) {
    return null;
  }

  const jsonStr = trimmed.slice(6); // 移除 "data: " 前缀
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.warn('[SSE] Failed to parse chunk:', jsonStr, error);
    return null;
  }
}

/**
 * 创建 SSE 流式连接（使用 fetch + ReadableStream）
 * 支持 POST 请求体，适合发送消息内容
 * 
 * @param message 用户消息
 * @param conversationId 会话ID（可选）
 * @param handlers 事件处理器
 * @param signal AbortController 的 signal，用于中断请求
 * @returns Promise，在流式传输完成时 resolve
 */
export async function createSSEConnection(
  message: string,
  conversationId: number | undefined,
  handlers: SSEHandlers,
  signal: AbortSignal
): Promise<void> {
  const requestBody: any = { message };
  if (conversationId !== undefined) {
    requestBody.conversationId = conversationId;
  }

  let response: Response;
  try {
    const token = getToken();
    response = await fetch('/agent/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody),
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      console.debug('[SSE] Request aborted');
      return;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    handlers.onError?.({ type: 'error', message: `连接失败: ${errorMessage}` });
    return;
  }

  // 检查响应状态
  if (!response.ok) {
    const errorMessage = response.status === 401 
      ? '认证失败，请重新登录'
      : response.status === 429 
        ? '请求过于频繁，请稍后重试'
        : `服务器错误 (${response.status})`;
    
    handlers.onError?.({ type: 'error', message: errorMessage });
    return;
  }

  // 检查 response body
  if (!response.body) {
    handlers.onError?.({ type: 'error', message: '服务器未返回流式数据' });
    return;
  }

  // 读取流式数据
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.debug('[SSE] Stream ended');
        break;
      }

      // 解码数据块
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // 按行分割并解析
      const lines = buffer.split('\n');
      // 保留最后一个可能不完整的行
      buffer = lines.pop() || '';

      for (const line of lines) {
        const eventData = parseSSEChunk(line);
        if (!eventData) {
          continue;
        }

        if (eventData.type === 'chunk') {
          handlers.onChunk?.(eventData.content, eventData.index);
          
          // 提取 conversationId（首次响应时）
          if (eventData.conversationId) {
            handlers.onConversationId?.(eventData.conversationId);
          }
        } else if (eventData.type === 'done') {
          handlers.onDone?.(eventData as SEDoneData);
        } else if (eventData.type === 'error') {
          handlers.onError?.(eventData as SEEErrorData);
        } else if (eventData.type === 'ping') {
          // 忽略 ping 心跳
          console.debug('[SSE] ping received');
        }
      }
    }
  } catch (error) {
    if (signal.aborted) {
      console.debug('[SSE] Stream aborted');
      return;
    }
    
    const errorMessage = error instanceof Error ? error.message : '读取流式数据失败';
    handlers.onError?.({ type: 'error', message: errorMessage });
  }
}
