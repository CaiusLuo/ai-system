export const CHAT_CONVERSATIONS_KEY = 'chat_conversations';
export const CHAT_CURRENT_CONV_KEY = 'chat_current_conv_id';

/**
 * 清理所有持久化聊天状态，避免跨账号泄漏。
 */
export function clearPersistedChatState(): void {
  localStorage.removeItem(CHAT_CONVERSATIONS_KEY);
  localStorage.removeItem(CHAT_CURRENT_CONV_KEY);
  sessionStorage.removeItem(CHAT_CONVERSATIONS_KEY);
  sessionStorage.removeItem(CHAT_CURRENT_CONV_KEY);
}
