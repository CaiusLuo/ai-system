import { recoverStreamParamsSchema } from '../schemas';
import { getAuthStatus, getToken, redirectToLogin } from './auth';
import { type SSEHandlers, readSSEStream } from './sse';

export async function recoverSSEConnection(
  conversationId: number,
  messageId: string,
  lastEventId: string | undefined,
  handlers: SSEHandlers,
  signal: AbortSignal
): Promise<void> {
  const recoverParams = recoverStreamParamsSchema.parse({
    conversationId,
    messageId,
    lastEventId,
  });

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

  const token = getToken();
  if (!token) {
    handlers.onError?.({ type: 'error', message: '未登录' });
    redirectToLogin('unauthorized');
    return;
  }

  const params = new URLSearchParams({
    conversationId: recoverParams.conversationId.toString(),
    messageId: recoverParams.messageId,
  });

  if (recoverParams.lastEventId) {
    params.append('lastEventId', recoverParams.lastEventId);
  }

  const url = `/agent/chat/stream/recover?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      console.debug('[SSE Recover] Request aborted');
      return;
    }

    let errorMessage = '恢复连接失败';
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = '网络连接失败，请检查网络后重试';
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      console.debug('[SSE Recover] Request aborted by signal');
      return;
    } else if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('reset')
      ) {
        errorMessage = '网络连接中断，请重试';
      } else {
        errorMessage = `恢复连接失败: ${error.message}`;
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
          : response.status === 404
            ? '消息不存在'
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

    handlers.onError?.({ type: 'error', message: errorMessage });
    return;
  }

  if (!response.body) {
    handlers.onError?.({ type: 'error', message: '服务器未返回流式数据' });
    return;
  }

  await readSSEStream(response, handlers, signal, {
    heartbeatTimeout: 120_000,
  });
}
