import { getAuthStatus, getToken, redirectToLogin } from './auth';
import { SSEMessageIdData, SSEChunkData, SEDoneData, SEEErrorData, SEPingData } from '../types';

export type { SSEMessageIdData, SSEChunkData, SEDoneData, SEEErrorData, SEPingData };

export type SSEEventData = SSEMessageIdData | SSEChunkData | SEDoneData | SEEErrorData | SEPingData;

// SSE 回调类型
export type SSEHandlers = {
  onChunk?: (content: string, index: number) => void;
  onReasoning?: (reasoning: string, index: number) => void; // 思考过程
  onDone?: (data: SEDoneData) => void;
  onError?: (error: SEEErrorData) => void;
  onConversationId?: (conversationId: number) => void; // 新增：提取 conversationId
  onMessageId?: (messageId: string) => void; // 新增：提取 messageId
};

/**
 * 解析完整的多行 SSE 事件块
 * 支持标准 SSE 格式：
 * event: chunk
 * data: {"content": "hello"}
 *
 * 也兼容简化格式：
 * data: {"content": "hello"}
 */
export function parseSSEBlock(block: string): SSEEventData | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  let eventType = 'chunk'; // 默认事件类型
  let dataStr = '';

  // 按行分割
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const lineTrimmed = line.trim();
    
    if (lineTrimmed.startsWith('event: ')) {
      eventType = lineTrimmed.slice(7).trim();
    } else if (lineTrimmed.startsWith('data: ')) {
      dataStr = lineTrimmed.slice(6);
    } else if (lineTrimmed.startsWith('data:')) {
      // 处理 "data:" 后面没有空格的情况
      dataStr = lineTrimmed.slice(5);
    }
  }

  // 如果没有找到 data，尝试直接解析整个块
  if (!dataStr && trimmed.startsWith('data: ')) {
    dataStr = trimmed.slice(6);
  }

  if (!dataStr) {
    return null;
  }

  try {
    const parsed = JSON.parse(dataStr);
    // 如果 JSON 中已有 type 字段，使用它；否则使用从 event: 行提取的
    return {
      type: parsed.type || eventType,
      ...parsed,
    };
  } catch (error) {
    console.warn('[SSE] Failed to parse SSE block:', trimmed, error);
    return null;
  }
}

/**
 * 读取和处理 SSE 流式数据（通用函数）
 */
export async function readSSEStream(
  response: Response,
  handlers: SSEHandlers,
  signal: AbortSignal
): Promise<void> {
  // 检查 response body
  if (!response.body) {
    handlers.onError?.({ type: 'error', message: '服务器未返回流式数据' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminalEventReceived = false;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // 处理剩余的 buffer
        if (buffer.trim()) {
          const eventData = parseSSEBlock(buffer);
          if (eventData) {
            terminalEventReceived = dispatchSSEEvent(eventData, handlers) || terminalEventReceived;
          }
        }
        console.debug('[SSE] Stream ended');
        if (!signal.aborted && !terminalEventReceived) {
          handlers.onError?.({ type: 'error', message: '连接意外中断，请重试' });
        }
        break;
      }

      // 解码数据块
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // 按 SSE 标准分隔符 \n\n 分割事件块
      const blocks = buffer.split('\n\n');
      // 保留最后一个可能不完整的块
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        const eventData = parseSSEBlock(block);
        if (!eventData) {
          continue;
        }
        terminalEventReceived = dispatchSSEEvent(eventData, handlers) || terminalEventReceived;
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
  const authStatus = getAuthStatus();
  if (authStatus === 'expired') {
    handlers.onError?.({ type: 'error', message: '登录已过期，请重新登录' });
    redirectToLogin('session-expired');
    return;
  }

  if (authStatus === 'invalid') {
    handlers.onError?.({ type: 'error', message: '登录信息无效，请重新登录' });
    redirectToLogin('unauthorized');
    return;
  }

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
    let errorMessage = response.status === 401
      ? '认证失败，请重新登录'
      : response.status === 403
        ? '无权访问当前会话'
      : response.status === 429
        ? '请求过于频繁，请稍后重试'
        : `服务器错误 (${response.status})`;

    if (response.status === 401) {
      try {
        const errorData = await response.json();
        errorMessage = errorData?.message || errorMessage;
      } catch {
        // ignore JSON parse failure and keep fallback message
      }

      handlers.onError?.({ type: 'error', message: errorMessage });
      redirectToLogin(errorMessage.includes('过期') ? 'session-expired' : 'unauthorized');
      return;
    }

    if (response.status === 403) {
      try {
        const errorData = await response.json();
        errorMessage = errorData?.message || errorMessage;
      } catch {
        // ignore JSON parse failure and keep fallback message
      }
    }
    
    handlers.onError?.({ type: 'error', message: errorMessage });
    return;
  }

  // 读取流式数据
  await readSSEStream(response, handlers, signal);
}

/**
 * 分发 SSE 事件到对应的处理器
 */
export function dispatchSSEEvent(eventData: SSEEventData, handlers: SSEHandlers): boolean {
  if (eventData.type === 'message_id') {
    // ⭐ 首个事件：立即保存 messageId（用于后续中断操作）
    const messageIdData = eventData as SSEMessageIdData;
    if (messageIdData.messageId) {
      handlers.onMessageId?.(messageIdData.messageId);
    }
    return false;
  } else if (eventData.type === 'chunk') {
    // 处理思考过程（reasoning 或 info 字段）
    const reasoningContent = (eventData as SSEChunkData).reasoning || (eventData as SSEChunkData).info;
    if (reasoningContent) {
      handlers.onReasoning?.(reasoningContent, (eventData as SSEChunkData).index);
    }

    // 处理正式回复内容 — 过滤掉 undefined/null/空字符串，防止 "" + undefined → "undefined"
    const content = (eventData as SSEChunkData).content;
    if (content) {
      handlers.onChunk?.(content, (eventData as SSEChunkData).index);
    }

    // 提取 conversationId（首次响应时）
    if ((eventData as SSEChunkData).conversationId) {
      handlers.onConversationId?.((eventData as SSEChunkData).conversationId!);
    }
    return false;
  } else if (eventData.type === 'done') {
    const doneData = eventData as SEDoneData;
    
    // 提取 conversationId（done 事件中必填）
    handlers.onConversationId?.(doneData.conversationId);
    
    handlers.onDone?.(doneData);
    return true;
  } else if (eventData.type === 'error') {
    handlers.onError?.(eventData as SEEErrorData);
    return true;
  } else if (eventData.type === 'ping') {
    console.debug('[SSE] ping received');
    return false;
  }
  return false;
}
