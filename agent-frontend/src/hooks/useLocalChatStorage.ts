import { useCallback } from 'react';
import { CHAT_CONVERSATIONS_KEY, CHAT_CURRENT_CONV_KEY, clearPersistedChatState } from '../services/chatStorage';

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
}

interface StoredConversation {
  id: number | null;  // null 表示新对话（尚未保存到后端）
  backendId?: number;  // 后端会话 ID（别名）
  title: string;
  messages: StoredMessage[];
  lastMessageContent: string | null;  // 最新消息内容（预览）
  lastMessageTime: string | null;     // 最新消息时间（ISO 8601）
  createdAt: number;
  updatedAt: number;
}

// 最大存储对话数
const MAX_CONVERSATIONS = 50;
// 每个对话最大消息数
const MAX_MESSAGES = 200;

/**
 * 获取所有本地存储的对话
 */
export function getStoredConversations(): Record<string, StoredConversation> {
  try {
    const data = localStorage.getItem(CHAT_CONVERSATIONS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * 保存所有对话到本地存储
 */
function saveStoredConversations(convs: Record<string, StoredConversation>): void {
  try {
    localStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(convs));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save conversations:', e);
  }
}

/**
 * 生成本地对话 ID
 */
function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 本地存储 Hook - 管理对话和消息的本地缓存
 */
export function useLocalChatStorage() {
  // 获取当前对话 ID
  const getCurrentConvId = useCallback((): string | null => {
    try {
      return localStorage.getItem(CHAT_CURRENT_CONV_KEY);
    } catch {
      return null;
    }
  }, []);

  // 设置当前对话 ID
  const setCurrentConvId = useCallback((id: string | null) => {
    try {
      if (id === null) {
        localStorage.removeItem(CHAT_CURRENT_CONV_KEY);
      } else {
        localStorage.setItem(CHAT_CURRENT_CONV_KEY, id);
      }
    } catch (e) {
      console.warn('[LocalStorage] Failed to set current conv id:', e);
    }
  }, []);

  // 获取当前对话
  const getCurrentConversation = useCallback((): StoredConversation | null => {
    const convId = getCurrentConvId();
    if (!convId) return null;

    const convs = getStoredConversations();
    return convs[convId] || null;
  }, [getCurrentConvId]);

  // 获取对话列表（元信息，不含消息）
  const getConversationList = useCallback((): Array<{
    id: string;
    title: string;
    backendId: number | null;
    updatedAt: number;
    lastMessageContent: string | null;
    lastMessageTime: string | null;
  }> => {
    const convs = getStoredConversations();
    // 不排序，保持对象中的顺序（即用户拖拽后的顺序）
    return Object.entries(convs)
      .map(([key, conv]) => ({
        id: key,
        title: conv.title,
        backendId: conv.id,
        updatedAt: conv.updatedAt,
        lastMessageContent: conv.lastMessageContent,
        lastMessageTime: conv.lastMessageTime,
      }))
      .slice(0, MAX_CONVERSATIONS);
  }, []);

  // 创建新对话
  const createConversation = useCallback((title?: string): string => {
    const convId = generateLocalId();
    const convs = getStoredConversations();

    convs[convId] = {
      id: null,  // 尚未同步到后端
      title: title || '新对话',
      messages: [],
      lastMessageContent: null,
      lastMessageTime: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveStoredConversations(convs);
    setCurrentConvId(convId);
    return convId;
  }, [setCurrentConvId]);

  // 添加消息到当前对话
  const addMessage = useCallback((message: Omit<StoredMessage, 'timestamp'>) => {
    const convId = getCurrentConvId();
    if (!convId) return;

    const convs = getStoredConversations();
    const conv = convs[convId];
    if (!conv) return;

    // 限制消息数量
    if (conv.messages.length >= MAX_MESSAGES) {
      conv.messages = conv.messages.slice(-MAX_MESSAGES);
    }

    const timestamp = Date.now();
    conv.messages.push({ ...message, timestamp });
    conv.updatedAt = timestamp;

    // 更新最新消息内容
    conv.lastMessageContent = message.content;
    conv.lastMessageTime = new Date(timestamp).toISOString();

    // 如果是第一条用户消息，使用它作为对话标题
    if (conv.messages.length === 1 && message.role === 'user') {
      conv.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
    }

    convs[convId] = conv;
    saveStoredConversations(convs);
  }, [getCurrentConvId]);

  // 更新最后一条消息（用于流式输出）
  const updateLastMessage = useCallback((updater: (msg: StoredMessage) => StoredMessage) => {
    const convId = getCurrentConvId();
    if (!convId) return;

    const convs = getStoredConversations();
    const conv = convs[convId];
    if (!conv || conv.messages.length === 0) return;

    const lastIdx = conv.messages.length - 1;
    conv.messages[lastIdx] = updater(conv.messages[lastIdx]);
    conv.updatedAt = Date.now();

    convs[convId] = conv;
    saveStoredConversations(convs);
  }, [getCurrentConvId]);

  // 删除对话
  const deleteConversation = useCallback((convId: string) => {
    const convs = getStoredConversations();
    delete convs[convId];
    saveStoredConversations(convs);

    // 如果删除的是当前对话，清除当前 ID
    if (getCurrentConvId() === convId) {
      setCurrentConvId(null);
    }
  }, [getCurrentConvId, setCurrentConvId]);

  // 切换对话
  const switchConversation = useCallback((convId: string) => {
    setCurrentConvId(convId);
  }, [setCurrentConvId]);

  // 同步后端对话 ID（当后端返回真实 ID 后更新本地记录）
  const syncBackendId = useCallback((localConvId: string, backendId: number) => {
    const convs = getStoredConversations();
    const conv = convs[localConvId];
    if (!conv) return;

    conv.id = backendId;
    convs[localConvId] = conv;
    saveStoredConversations(convs);
  }, []);

  // 清空所有本地数据
  const clearAll = useCallback(() => {
    clearPersistedChatState();
  }, []);

  return {
    getCurrentConvId,
    setCurrentConvId,
    getCurrentConversation,
    getConversationList,
    createConversation,
    addMessage,
    updateLastMessage,
    deleteConversation,
    switchConversation,
    syncBackendId,
    clearAll,
  };
}
