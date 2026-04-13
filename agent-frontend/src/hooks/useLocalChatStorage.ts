import { useCallback } from 'react';
import {
  localConversationSummarySchema,
  storedConversationSchema,
  storedMessageSchema,
  type LocalConversationSummary,
  type StoredConversation,
  type StoredConversationMap,
  type StoredMessage,
} from '../schemas';
import {
  CHAT_CONVERSATIONS_KEY,
  CHAT_CURRENT_CONV_KEY,
  clearPersistedChatState,
} from '../services/chatStorage';

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES = 200;

function parseStoredConversationMap(value: unknown): StoredConversationMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<StoredConversationMap>(
    (result, [key, conversation]) => {
      const parsedConversation = storedConversationSchema.safeParse(conversation);
      if (parsedConversation.success) {
        result[key] = parsedConversation.data;
      } else {
        console.warn(
          `[LocalStorage] Skipped invalid conversation "${key}"`,
          parsedConversation.error.flatten()
        );
      }

      return result;
    },
    {}
  );
}

export function getStoredConversations(): StoredConversationMap {
  try {
    const data = localStorage.getItem(CHAT_CONVERSATIONS_KEY);
    if (!data) {
      return {};
    }

    return parseStoredConversationMap(JSON.parse(data));
  } catch {
    return {};
  }
}

function saveStoredConversations(conversations: StoredConversationMap): void {
  try {
    localStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.warn('[LocalStorage] Failed to save conversations:', error);
  }
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useLocalChatStorage() {
  const getCurrentConvId = useCallback((): string | null => {
    try {
      return localStorage.getItem(CHAT_CURRENT_CONV_KEY);
    } catch {
      return null;
    }
  }, []);

  const setCurrentConvId = useCallback((id: string | null) => {
    try {
      if (id === null) {
        localStorage.removeItem(CHAT_CURRENT_CONV_KEY);
      } else {
        localStorage.setItem(CHAT_CURRENT_CONV_KEY, id);
      }
    } catch (error) {
      console.warn('[LocalStorage] Failed to set current conv id:', error);
    }
  }, []);

  const getCurrentConversation = useCallback((): StoredConversation | null => {
    const convId = getCurrentConvId();
    if (!convId) {
      return null;
    }

    const conversations = getStoredConversations();
    return conversations[convId] || null;
  }, [getCurrentConvId]);

  const getConversationList = useCallback((): LocalConversationSummary[] => {
    const conversations = getStoredConversations();

    return Object.entries(conversations)
      .map(([key, conversation]) =>
        localConversationSummarySchema.parse({
          id: key,
          title: conversation.title,
          backendId: conversation.backendId ?? conversation.id,
          updatedAt: conversation.updatedAt,
          lastMessageContent: conversation.lastMessageContent,
          lastMessageTime: conversation.lastMessageTime,
        })
      )
      .slice(0, MAX_CONVERSATIONS);
  }, []);

  const createConversation = useCallback(
    (title?: string): string => {
      const convId = generateLocalId();
      const conversations = getStoredConversations();

      conversations[convId] = storedConversationSchema.parse({
        id: null,
        title: title || '新对话',
        messages: [],
        lastMessageContent: null,
        lastMessageTime: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      saveStoredConversations(conversations);
      setCurrentConvId(convId);
      return convId;
    },
    [setCurrentConvId]
  );

  const addMessage = useCallback(
    (message: Omit<StoredMessage, 'timestamp'>) => {
      const convId = getCurrentConvId();
      if (!convId) {
        return;
      }

      const conversations = getStoredConversations();
      const conversation = conversations[convId];
      if (!conversation) {
        return;
      }

      if (conversation.messages.length >= MAX_MESSAGES) {
        conversation.messages = conversation.messages.slice(-(MAX_MESSAGES - 1));
      }

      const timestamp = Date.now();
      const nextMessage = storedMessageSchema.parse({
        ...message,
        timestamp,
      });

      conversation.messages.push(nextMessage);
      conversation.updatedAt = timestamp;
      conversation.lastMessageContent = nextMessage.content;
      conversation.lastMessageTime = new Date(timestamp).toISOString();

      if (conversation.messages.length === 1 && nextMessage.role === 'user') {
        conversation.title =
          nextMessage.content.slice(0, 30) +
          (nextMessage.content.length > 30 ? '...' : '');
      }

      conversations[convId] = conversation;
      saveStoredConversations(conversations);
    },
    [getCurrentConvId]
  );

  const updateLastMessage = useCallback(
    (updater: (message: StoredMessage) => StoredMessage) => {
      const convId = getCurrentConvId();
      if (!convId) {
        return;
      }

      const conversations = getStoredConversations();
      const conversation = conversations[convId];
      if (!conversation || conversation.messages.length === 0) {
        return;
      }

      const lastIndex = conversation.messages.length - 1;
      const updatedMessage = storedMessageSchema.parse(
        updater(conversation.messages[lastIndex])
      );

      conversation.messages[lastIndex] = updatedMessage;
      conversation.updatedAt = Date.now();
      conversation.lastMessageContent = updatedMessage.content;
      conversation.lastMessageTime = new Date(conversation.updatedAt).toISOString();

      conversations[convId] = conversation;
      saveStoredConversations(conversations);
    },
    [getCurrentConvId]
  );

  const deleteConversation = useCallback(
    (convId: string) => {
      const conversations = getStoredConversations();
      delete conversations[convId];
      saveStoredConversations(conversations);

      if (getCurrentConvId() === convId) {
        setCurrentConvId(null);
      }
    },
    [getCurrentConvId, setCurrentConvId]
  );

  const switchConversation = useCallback(
    (convId: string) => {
      setCurrentConvId(convId);
    },
    [setCurrentConvId]
  );

  const syncBackendId = useCallback((localConvId: string, backendId: number) => {
    const conversations = getStoredConversations();
    const conversation = conversations[localConvId];
    if (!conversation) {
      return;
    }

    conversation.id = backendId;
    conversation.backendId = backendId;
    conversations[localConvId] = conversation;
    saveStoredConversations(conversations);
  }, []);

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
