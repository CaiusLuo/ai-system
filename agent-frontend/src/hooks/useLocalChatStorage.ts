import { useCallback } from 'react';
import {
  localConversationSummarySchema,
  storedConversationSchema,
  storedMessageSchema,
  type ConversationDTO,
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
const DEFAULT_CONVERSATION_TITLE = '新对话';

interface CreateConversationOptions {
  title?: string;
  initialMessage?: Omit<StoredMessage, 'timestamp'>;
  reuseEmptyCurrent?: boolean;
}

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

function getBackendConversationId(conversation: StoredConversation): number | null {
  const backendId = conversation.backendId ?? conversation.id;
  return typeof backendId === 'number' ? backendId : null;
}

function getConversationIdentity(key: string, conversation: StoredConversation): string {
  const backendId = getBackendConversationId(conversation);
  if (backendId !== null) {
    return `backend:${backendId}`;
  }

  if (conversation.tempId) {
    return `temp:${conversation.tempId}`;
  }

  return `local:${key}`;
}

function isPlaceholderTitle(title: string | undefined): boolean {
  return !title || title === DEFAULT_CONVERSATION_TITLE;
}

function deriveConversationTitle(title?: string, firstUserMessage?: string): string {
  const normalizedTitle = title?.trim();
  if (normalizedTitle) {
    return normalizedTitle;
  }

  const normalizedMessage = firstUserMessage?.trim();
  if (!normalizedMessage) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  return normalizedMessage.slice(0, 30) + (normalizedMessage.length > 30 ? '...' : '');
}

function toMessageTimestampIso(message?: StoredMessage): string | null {
  if (!message) {
    return null;
  }

  return new Date(message.timestamp).toISOString();
}

function normalizeLastMessageTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return Number.isNaN(Date.parse(value)) ? null : value;
}

function pickPreferredConversationKey(
  primaryKey: string,
  primary: StoredConversation,
  secondaryKey: string,
  secondary: StoredConversation
): string {
  const primaryIsServer = primaryKey.startsWith('server_');
  const secondaryIsServer = secondaryKey.startsWith('server_');

  if (primaryIsServer !== secondaryIsServer) {
    return primaryIsServer ? secondaryKey : primaryKey;
  }

  if (Boolean(primary.tempId) !== Boolean(secondary.tempId)) {
    return primary.tempId ? primaryKey : secondaryKey;
  }

  if (primary.messages.length !== secondary.messages.length) {
    return primary.messages.length > secondary.messages.length ? primaryKey : secondaryKey;
  }

  if (primary.updatedAt !== secondary.updatedAt) {
    return primary.updatedAt >= secondary.updatedAt ? primaryKey : secondaryKey;
  }

  return primaryKey;
}

function mergeConversationRecords(
  primary: StoredConversation,
  secondary: StoredConversation
): StoredConversation {
  const latestConversation = primary.updatedAt >= secondary.updatedAt ? primary : secondary;
  const fallbackConversation = latestConversation === primary ? secondary : primary;
  const messages =
    latestConversation.messages.length >= fallbackConversation.messages.length
      ? latestConversation.messages
      : fallbackConversation.messages;
  const lastMessage = messages[messages.length - 1];
  const backendId =
    getBackendConversationId(primary) ?? getBackendConversationId(secondary) ?? undefined;

  const title = !isPlaceholderTitle(latestConversation.title)
    ? latestConversation.title
    : !isPlaceholderTitle(fallbackConversation.title)
      ? fallbackConversation.title
      : deriveConversationTitle(
          undefined,
          messages.find((message) => message.role === 'user')?.content
        );

  const updatedAt = Math.max(
    primary.updatedAt,
    secondary.updatedAt,
    lastMessage?.timestamp ?? 0
  );

  return storedConversationSchema.parse({
    id: backendId ?? null,
    ...(backendId !== undefined ? { backendId } : {}),
    ...(backendId === undefined
      ? { tempId: primary.tempId ?? secondary.tempId }
      : {}),
    title,
    messages,
    lastMessageContent:
      latestConversation.lastMessageContent ??
      fallbackConversation.lastMessageContent ??
      lastMessage?.content ??
      null,
    lastMessageTime:
      latestConversation.lastMessageTime ??
      fallbackConversation.lastMessageTime ??
      toMessageTimestampIso(lastMessage),
    createdAt: Math.min(primary.createdAt, secondary.createdAt),
    updatedAt,
  });
}

function dedupeConversationMap(conversations: StoredConversationMap): StoredConversationMap {
  const deduped: StoredConversationMap = {};
  const identityToKey = new Map<string, string>();

  for (const [key, conversation] of Object.entries(conversations)) {
    const normalizedConversation = storedConversationSchema.parse({
      ...conversation,
      id: getBackendConversationId(conversation) ?? conversation.id ?? null,
      ...(getBackendConversationId(conversation) !== null
        ? { backendId: getBackendConversationId(conversation)! }
        : {}),
      ...(getBackendConversationId(conversation) === null && conversation.tempId
        ? { tempId: conversation.tempId }
        : {}),
    });
    const identity = getConversationIdentity(key, normalizedConversation);
    const existingKey = identityToKey.get(identity);

    if (!existingKey) {
      deduped[key] = normalizedConversation;
      identityToKey.set(identity, key);
      continue;
    }

    const existingConversation = deduped[existingKey];
    const preferredKey = pickPreferredConversationKey(
      existingKey,
      existingConversation,
      key,
      normalizedConversation
    );
    const mergedConversation = mergeConversationRecords(
      existingConversation,
      normalizedConversation
    );

    if (preferredKey === existingKey) {
      deduped[existingKey] = mergedConversation;
      continue;
    }

    delete deduped[existingKey];
    deduped[key] = mergedConversation;
    identityToKey.set(identity, key);
  }

  return deduped;
}

function serializeConversationMap(conversations: StoredConversationMap): string {
  return JSON.stringify(conversations);
}

export function getStoredConversations(): StoredConversationMap {
  try {
    const data = localStorage.getItem(CHAT_CONVERSATIONS_KEY);
    if (!data) {
      return {};
    }

    return dedupeConversationMap(parseStoredConversationMap(JSON.parse(data)));
  } catch {
    return {};
  }
}

function saveStoredConversations(conversations: StoredConversationMap): StoredConversationMap {
  const normalizedConversations = dedupeConversationMap(conversations);

  try {
    localStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(normalizedConversations));
  } catch (error) {
    console.warn('[LocalStorage] Failed to save conversations:', error);
  }

  return normalizedConversations;
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

  const getConversationById = useCallback((convId: string): StoredConversation | null => {
    const conversations = getStoredConversations();
    return conversations[convId] || null;
  }, []);

  const getCurrentConversation = useCallback((): StoredConversation | null => {
    const convId = getCurrentConvId();
    if (!convId) {
      return null;
    }

    return getConversationById(convId);
  }, [getConversationById, getCurrentConvId]);

  const getConversationList = useCallback((): LocalConversationSummary[] => {
    const conversations = getStoredConversations();

    return Object.entries(conversations)
      .map(([key, conversation]) =>
        localConversationSummarySchema.parse({
          id: key,
          title: conversation.title,
          backendId: getBackendConversationId(conversation),
          tempId: conversation.tempId,
          updatedAt: conversation.updatedAt,
          lastMessageContent: conversation.lastMessageContent,
          lastMessageTime: conversation.lastMessageTime,
        })
      )
      .slice(0, MAX_CONVERSATIONS);
  }, []);

  const createConversation = useCallback(
    (options?: CreateConversationOptions): string => {
      const conversations = getStoredConversations();
      const currentConvId = getCurrentConvId();
      const currentConversation = currentConvId ? conversations[currentConvId] : null;
      const shouldReuseEmptyCurrent = options?.reuseEmptyCurrent ?? true;
      const timestamp = Date.now();
      const initialMessage = options?.initialMessage
        ? storedMessageSchema.parse({
            ...options.initialMessage,
            timestamp,
          })
        : null;

      if (
        shouldReuseEmptyCurrent &&
        currentConvId &&
        currentConversation &&
        getBackendConversationId(currentConversation) === null &&
        currentConversation.messages.length === 0
      ) {
        conversations[currentConvId] = storedConversationSchema.parse({
          ...currentConversation,
          tempId: currentConversation.tempId ?? currentConvId,
          title: deriveConversationTitle(
            options?.title,
            initialMessage?.role === 'user' ? initialMessage.content : undefined
          ),
          messages: initialMessage ? [initialMessage] : currentConversation.messages,
          lastMessageContent: initialMessage?.content ?? currentConversation.lastMessageContent,
          lastMessageTime:
            initialMessage ? new Date(timestamp).toISOString() : currentConversation.lastMessageTime,
          updatedAt: timestamp,
        });

        saveStoredConversations(conversations);
        setCurrentConvId(currentConvId);
        return currentConvId;
      }

      const convId = generateLocalId();

      conversations[convId] = storedConversationSchema.parse({
        id: null,
        tempId: convId,
        title: deriveConversationTitle(
          options?.title,
          initialMessage?.role === 'user' ? initialMessage.content : undefined
        ),
        messages: initialMessage ? [initialMessage] : [],
        lastMessageContent: initialMessage?.content ?? null,
        lastMessageTime: initialMessage ? new Date(timestamp).toISOString() : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      saveStoredConversations(conversations);
      setCurrentConvId(convId);
      return convId;
    },
    [getCurrentConvId, setCurrentConvId]
  );

  const addMessage = useCallback(
    (message: Omit<StoredMessage, 'timestamp'>, conversationId?: string) => {
      const convId = conversationId ?? getCurrentConvId();
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
        conversation.title = deriveConversationTitle(undefined, nextMessage.content);
      }

      conversations[convId] = storedConversationSchema.parse(conversation);
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

      conversations[convId] = storedConversationSchema.parse(conversation);
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

  const syncBackendId = useCallback(
    (localConvId: string, backendId: number): string | null => {
      const conversations = getStoredConversations();
      const conversation = conversations[localConvId];

      if (!conversation) {
        const existingEntry = Object.entries(conversations).find(([, candidate]) => {
          return getBackendConversationId(candidate) === backendId;
        });
        return existingEntry?.[0] ?? null;
      }

      let nextConversation = storedConversationSchema.parse({
        ...conversation,
        id: backendId,
        backendId,
        tempId: undefined,
      });

      const duplicateEntry = Object.entries(conversations).find(([key, candidate]) => {
        return key !== localConvId && getBackendConversationId(candidate) === backendId;
      });

      if (duplicateEntry) {
        const [duplicateKey, duplicateConversation] = duplicateEntry;
        nextConversation = mergeConversationRecords(nextConversation, duplicateConversation);
        delete conversations[duplicateKey];

        if (getCurrentConvId() === duplicateKey) {
          setCurrentConvId(localConvId);
        }
      }

      conversations[localConvId] = nextConversation;
      saveStoredConversations(conversations);
      return localConvId;
    },
    [getCurrentConvId, setCurrentConvId]
  );

  const mergeRemoteConversations = useCallback((remoteConversations: ConversationDTO[]): boolean => {
    const previousConversations = getStoredConversations();
    const nextConversations: StoredConversationMap = { ...previousConversations };
    const localKeyByBackendId = new Map<number, string>();
    const now = Date.now();

    for (const [localKey, conversation] of Object.entries(previousConversations)) {
      const backendId = getBackendConversationId(conversation);
      if (backendId !== null) {
        localKeyByBackendId.set(backendId, localKey);
      }
    }

    for (const remoteConversation of remoteConversations) {
      const localKey = localKeyByBackendId.get(remoteConversation.id) ?? `server_${remoteConversation.id}`;
      const existing = nextConversations[localKey];
      const createdAt = Date.parse(remoteConversation.createdAt);
      const updatedAt = Date.parse(remoteConversation.updatedAt);

      nextConversations[localKey] = storedConversationSchema.parse({
        id: remoteConversation.id,
        backendId: remoteConversation.id,
        title: remoteConversation.title || existing?.title || DEFAULT_CONVERSATION_TITLE,
        messages: existing?.messages ?? [],
        lastMessageContent: remoteConversation.lastMessageContent,
        lastMessageTime: normalizeLastMessageTime(remoteConversation.lastMessageTime),
        createdAt:
          existing?.createdAt ??
          (Number.isFinite(createdAt) ? createdAt : now),
        updatedAt:
          Number.isFinite(updatedAt) ? updatedAt : existing?.updatedAt ?? now,
      });
    }

    const normalizedConversations = dedupeConversationMap(nextConversations);
    if (
      serializeConversationMap(previousConversations) ===
      serializeConversationMap(normalizedConversations)
    ) {
      return false;
    }

    saveStoredConversations(normalizedConversations);
    return true;
  }, []);

  const reorderConversations = useCallback((orderedIds: string[]) => {
    const conversations = getStoredConversations();
    const orderedConversations: StoredConversationMap = {};

    orderedIds.forEach((id) => {
      if (conversations[id]) {
        orderedConversations[id] = conversations[id];
      }
    });

    Object.entries(conversations).forEach(([key, conversation]) => {
      if (!orderedConversations[key]) {
        orderedConversations[key] = conversation;
      }
    });

    saveStoredConversations(orderedConversations);
  }, []);

  const clearAll = useCallback(() => {
    clearPersistedChatState();
  }, []);

  return {
    getCurrentConvId,
    setCurrentConvId,
    getCurrentConversation,
    getConversationById,
    getConversationList,
    createConversation,
    addMessage,
    updateLastMessage,
    deleteConversation,
    switchConversation,
    syncBackendId,
    mergeRemoteConversations,
    reorderConversations,
    clearAll,
  };
}
