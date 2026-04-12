// SSE 断线恢复服务

import { getAuthStatus, getToken, redirectToLogin } from './auth';
import { SSEHandlers, readSSEStream } from './sse';

/**
 * 创建断线恢复的 SSE 连接
 * 
 * @param conversationId 对话ID（必填）
 * @param messageId 消息ID（必填）
 * @param lastEventId 最后接收到的事件ID（可选）
 * @param handlers 事件处理器
 * @param signal AbortController 的 signal，用于中断请求
 * @returns Promise，在流式传输完成时 resolve
 */
export async function recoverSSEConnection(
  conversationId: number,
  messageId: string,
  lastEventId: string | undefined,
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

  const token = getToken();
  if (!token) {
    handlers.onError?.({ type: 'error', message: '未登录' });
    redirectToLogin('unauthorized');
    return;
  }

  // 构建查询参数
  const params = new URLSearchParams({
    conversationId: conversationId.toString(),
    messageId,
  });
  if (lastEventId) {
    params.append('lastEventId', lastEventId);
  }

  const url = `/agent/chat/stream/recover?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      console.debug('[SSE Recover] Request aborted');
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Network error';
    handlers.onError?.({ type: 'error', message: `恢复连接失败: ${errorMessage}` });
    return;
  }

  // 检查响应状态
  if (!response.ok) {
    let errorMessage = response.status === 401
      ? '认证失败，请重新登录'
      : response.status === 403
        ? '无权访问当前对话'
        : response.status === 404
          ? '消息不存在'
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

    handlers.onError?.({ type: 'error', message: errorMessage });
    return;
  }

  // 检查 response body
  if (!response.body) {
    handlers.onError?.({ type: 'error', message: '服务器未返回流式数据' });
    return;
  }

  // 读取流式数据
  await readSSEStream(response, handlers, signal);
}
