import {
  sseEventDataSchema,
  streamChatParamsSchema,
  type SSEChunkData,
  type SEDoneData,
  type SEEErrorData,
  type SEPingData,
  type SSEEventData,
  type SSEMessageIdData,
} from '../schemas';
import { getAuthStatus, getToken, redirectToLogin } from './auth';

export type {
  SSEChunkData,
  SEDoneData,
  SEEErrorData,
  SEPingData,
  SSEMessageIdData,
};

export type SSEHandlers = {
  onChunk?: (content: string, index: number) => void;
  onReasoning?: (reasoning: string, index: number) => void;
  onDone?: (data: SEDoneData) => void;
  onError?: (error: SEEErrorData) => void;
  onConversationId?: (conversationId: number) => void;
  onMessageId?: (messageId: string) => void;
};

export function parseSSEBlock(block: string): SSEEventData | null {
  const trimmed = block.trim();
  if (!trimmed) {
    return null;
  }

  let eventType = 'chunk';
  let dataStr = '';

  const lines = trimmed.split('\n');
  for (const line of lines) {
    const currentLine = line.trim();

    if (currentLine.startsWith('event: ')) {
      eventType = currentLine.slice(7).trim();
    } else if (currentLine.startsWith('data: ')) {
      dataStr = currentLine.slice(6);
    } else if (currentLine.startsWith('data:')) {
      dataStr = currentLine.slice(5);
    }
  }

  if (!dataStr && trimmed.startsWith('data: ')) {
    dataStr = trimmed.slice(6);
  }

  if (!dataStr) {
    return null;
  }

  try {
    const parsed = JSON.parse(dataStr) as unknown;
    const candidate =
      parsed && typeof parsed === 'object'
        ? {
            ...(parsed as Record<string, unknown>),
            type:
              'type' in (parsed as Record<string, unknown>)
                ? (parsed as Record<string, unknown>).type
                : eventType,
          }
        : { type: eventType };

    const result = sseEventDataSchema.safeParse(candidate);
    if (!result.success) {
      console.warn('[SSE] Failed to validate SSE block:', trimmed, result.error.flatten());
      return null;
    }

    return result.data;
  } catch (error) {
    console.warn('[SSE] Failed to parse SSE block:', trimmed, error);
    return null;
  }
}

export async function readSSEStream(
  response: Response,
  handlers: SSEHandlers,
  signal: AbortSignal,
  options?: {
    heartbeatTimeout?: number;
  }
): Promise<void> {
  if (!response.body) {
    handlers.onError?.({ type: 'error', message: '服务器未返回流式数据' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const heartbeatTimeout = options?.heartbeatTimeout ?? 120_000;
  let lastDataTime = Date.now();
  let settled = false;

  const heartbeatTimer = setInterval(() => {
    if (!settled && Date.now() - lastDataTime > heartbeatTimeout) {
      clearInterval(heartbeatTimer);
      settled = true;
      handlers.onError?.({
        type: 'error',
        message: '连接超时，服务器长时间未返回数据，请重试',
      });
      reader.cancel();
    }
  }, Math.min(heartbeatTimeout, 30_000));

  try {
    while (true) {
      const { done, value } = await withTimeout(
        reader.read(),
        heartbeatTimeout,
        '读取流式数据超时'
      );

      if (done) {
        if (buffer.trim()) {
          const eventData = parseSSEBlock(buffer);
          if (eventData) {
            settled = dispatchSSEEvent(eventData, handlers) || settled;
          }
        }

        if (!settled) {
          settled = true;
          handlers.onDone?.({ type: 'done', conversationId: 0, messageId: '', info: '' });
        }

        console.debug('[SSE] Stream closed by server');
        break;
      }

      lastDataTime = Date.now();

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        const eventData = parseSSEBlock(block);
        if (!eventData) {
          continue;
        }

        settled = dispatchSSEEvent(eventData, handlers) || settled;
        if (settled) {
          console.debug('[SSE] Stream settled by event, stop reading loop');
          break;
        }
      }

      if (settled) {
        break;
      }
    }
  } catch (error) {
    clearInterval(heartbeatTimer);

    if (signal.aborted) {
      console.debug('[SSE] Stream aborted');
      return;
    }

    if (error instanceof Error && error.message === '读取流式数据超时') {
      handlers.onError?.({
        type: 'error',
        message: '连接超时，服务器长时间未返回数据，请重试',
      });
      return;
    }

    let errorMessage = '读取流式数据失败';
    if (error instanceof TypeError) {
      errorMessage = '网络连接异常，请检查网络后重试';
    } else if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('reset')
      ) {
        errorMessage = '网络连接中断，请重试';
      } else {
        errorMessage = error.message;
      }
    }

    handlers.onError?.({ type: 'error', message: errorMessage });
  } finally {
    clearInterval(heartbeatTimer);
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

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

  const requestBody = streamChatParamsSchema.parse({
    message,
    ...(conversationId !== undefined ? { conversationId } : {}),
  });

  let response: Response;
  try {
    const token = getToken();
    response = await fetch('/agent/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody),
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      console.debug('[SSE] Request aborted');
      return;
    }

    let errorMessage = '连接失败';
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = '网络连接失败，请检查网络后重试';
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      console.debug('[SSE] Request aborted by signal');
      return;
    } else if (error instanceof Error) {
      const networkMessage = error.message.toLowerCase();
      if (
        networkMessage.includes('network') ||
        networkMessage.includes('connection') ||
        networkMessage.includes('reset')
      ) {
        errorMessage = '网络连接中断，请重试';
      } else {
        errorMessage = `连接失败: ${error.message}`;
      }
    }

    handlers.onError?.({ type: 'error', message: errorMessage });
    return;
  }

  if (!response.ok) {
    let errorMessage =
      response.status === 401
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
        // keep fallback message
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
        // keep fallback message
      }
    }

    handlers.onError?.({ type: 'error', message: errorMessage });
    return;
  }

  await readSSEStream(response, handlers, signal, {
    heartbeatTimeout: 120_000,
  });
}

export function dispatchSSEEvent(
  eventData: SSEEventData,
  handlers: SSEHandlers
): boolean {
  switch (eventData.type) {
    case 'message_id':
      if (eventData.messageId) {
        handlers.onMessageId?.(eventData.messageId);
      }
      return false;
    case 'chunk': {
      const reasoningContent = eventData.reasoning || eventData.info;
      if (reasoningContent) {
        handlers.onReasoning?.(reasoningContent, eventData.index);
      }

      if (eventData.content) {
        handlers.onChunk?.(eventData.content, eventData.index);
      }

      if (typeof eventData.conversationId === 'number') {
        handlers.onConversationId?.(eventData.conversationId);
      }

      return false;
    }
    case 'done':
      handlers.onConversationId?.(eventData.conversationId);
      handlers.onDone?.(eventData);
      return true;
    case 'error':
      handlers.onError?.(eventData);
      return true;
    case 'ping':
      console.debug('[SSE] ping received');
      return false;
    default:
      return false;
  }
}
