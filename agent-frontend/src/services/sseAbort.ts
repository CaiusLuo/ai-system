import { z } from 'zod';
import { abortRequestSchema } from '../schemas';
import { api } from './api';

export async function abortStreamGeneration(messageId: string): Promise<boolean> {
  try {
    const result = await api.post(
      '/agent/chat/stream/abort',
      { messageId },
      z.boolean(),
      abortRequestSchema
    );
    return result.data;
  } catch (error) {
    console.error('[Abort] Failed to call abort API:', error);
    return false;
  }
}
