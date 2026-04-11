// Abort API 服务 - 用于中断 SSE 流式生成

import { api } from './api';

/**
 * 调用后端 abort 接口，中断流式生成
 *
 * @param messageId 后端生成的消息 ID
 * @returns Promise<boolean> true = 成功中断，false = 任务已结束或不存在
 */
export async function abortStreamGeneration(messageId: string): Promise<boolean> {
  try {
    const result = await api.post<boolean>('/agent/chat/stream/abort', { messageId });
    return result.data;
  } catch (error) {
    console.error('[Abort] Failed to call abort API:', error);
    return false;
  }
}
