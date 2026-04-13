import { useState, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  type Message,
  type MessageDTO,
} from '../schemas';
import { getConversationMessages } from '../services/conversation';
import {
  createSSEConnection,
  type SSEHandlers,
} from '../services/sse';
import { abortStreamGeneration } from '../services/sseAbort';
import { recoverSSEConnection } from '../services/sseRecover';

export type { Message };

interface UseSSEChatReturn {
  messages: Message[];
  currentStreamingMessage: string;
  currentStreamingReasoning: string;
  isLoading: boolean;
  error: string | null;
  conversationId: number | null;
  messageId: string | null;
  sendMessage: (message: string, conversationId?: number) => void;
  abortStream: () => void;
  clearMessages: () => void;
  resetChatState: () => void;
  setConversationId: (id: number | null) => void;
  loadConversation: (id: number) => Promise<void>;
  recoverStream: (
    conversationId: number,
    messageId: string,
    lastEventId?: string
  ) => void;
}

function toChatMessage(message: MessageDTO): Message {
  return {
    id: message.id,
    conversationId: message.conversationId,
    userId: message.userId,
    username: message.username,
    role: message.role,
    content: message.content,
    title: message.title,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export function useSSEChat(): UseSSEChatReturn {
  const STREAM_FINALIZE_DELAY_MS = 3000;

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');
  const [currentStreamingReasoning, setCurrentStreamingReasoning] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdRef = useRef<string | null>(null);
  const streamingBufferRef = useRef('');
  const streamingReasoningBufferRef = useRef('');
  const isLoadingRef = useRef(false);
  const conversationIdRef = useRef<number | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const closeConnection = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  }, []);

  const syncFinalAssistantMessage = useCallback(async (
    convId: number,
    expectedContent: string,
    expectedMessageId?: string
  ) => {
    try {
      const response = await getConversationMessages(convId);
      if (response.code !== 200 || !response.data.length) {
        return;
      }

      // 只同步本轮流式完成后的消息，避免后端落库慢时被上一轮 assistant 回滚覆盖
      const persistedAssistant = [...response.data]
        .reverse()
        .find(
          (message) =>
            message.role === 'assistant' &&
            message.content === expectedContent
        );

      if (!persistedAssistant) {
        console.debug('[SSE] Skip backend sync: target assistant message not persisted yet');
        return;
      }

      const normalizedMessage = toChatMessage(persistedAssistant);
      setMessages((prev) => {
        const next = [...prev];
        let targetIndex = -1;
        for (let i = next.length - 1; i >= 0; i -= 1) {
          const message = next[i];
          if (message.role !== 'assistant') {
            continue;
          }

          if (expectedMessageId && message.messageId) {
            if (message.messageId === expectedMessageId) {
              targetIndex = i;
              break;
            }
            continue;
          }

          if (message.content === expectedContent) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex >= 0) {
          next[targetIndex] = {
            ...next[targetIndex],
            ...normalizedMessage,
            // 保持本地的 messageId，防止覆盖丢失中断链路标识
            messageId: next[targetIndex].messageId,
            // 内容保持为本轮最终内容，避免被后端历史内容覆盖
            content: next[targetIndex].content,
          };
          return next;
        }

        return [...next, normalizedMessage];
      });
    } catch (syncError) {
      console.warn('[SSE] Failed to sync final assistant message from backend:', syncError);
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string, convId?: number) => {
      if (!message.trim() || isLoadingRef.current) {
        return;
      }

      clearFinalizeTimer();
      closeConnection();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setError(null);
      setCurrentStreamingMessage('');
      setCurrentStreamingReasoning('');
      streamingBufferRef.current = '';
      streamingReasoningBufferRef.current = '';
      setMessageId(null);
      messageIdRef.current = null;

      const userMessage: Message = { role: 'user', content: message.trim() };
      setMessages((prev) => [...prev, userMessage]);

      setIsLoading(true);
      isLoadingRef.current = true;

      const effectiveConvId = convId ?? conversationIdRef.current ?? undefined;

      const handlers: SSEHandlers = {
        onMessageId: (newMessageId) => {
          if (!messageIdRef.current) {
            messageIdRef.current = newMessageId;
            setMessageId(newMessageId);
            console.debug('[SSE] Received messageId:', newMessageId);
          }
        },

        onChunk: (content) => {
          if (!content) {
            return;
          }

          streamingBufferRef.current += content;
          flushSync(() => {
            setCurrentStreamingMessage(streamingBufferRef.current);
          });
        },

        onReasoning: (reasoning) => {
          if (!reasoning) {
            return;
          }

          streamingReasoningBufferRef.current += reasoning;
          flushSync(() => {
            setCurrentStreamingReasoning(streamingReasoningBufferRef.current);
          });
        },

        onConversationId: (newConversationId) => {
          conversationIdRef.current = newConversationId;
          setConversationId(newConversationId);
          console.debug('[SSE] Received conversationId:', newConversationId);
        },

        onDone: (data) => {
          console.debug('[SSE] Stream completed, messageId:', data.messageId);

          const finalContent = streamingBufferRef.current;
          const finalReasoning = streamingReasoningBufferRef.current;

          if (finalContent || finalReasoning) {
            const assistantMessage: Message = {
              role: 'assistant',
              content: finalContent,
              reasoning: finalReasoning || undefined,
              messageId: data.messageId,
              conversationId: data.conversationId,
            };
            setMessages((prev) => [...prev, assistantMessage]);
          }

          setIsLoading(false);
          isLoadingRef.current = false;
          abortControllerRef.current = null;

          clearFinalizeTimer();
          finalizeTimerRef.current = setTimeout(async () => {
            if (data.conversationId && finalContent) {
              await syncFinalAssistantMessage(
                data.conversationId,
                finalContent,
                data.messageId
              );
            }

            setCurrentStreamingMessage((prev) =>
              prev === finalContent ? '' : prev
            );
            setCurrentStreamingReasoning((prev) =>
              prev === finalReasoning ? '' : prev
            );

            if (streamingBufferRef.current === finalContent) {
              streamingBufferRef.current = '';
            }
            if (streamingReasoningBufferRef.current === finalReasoning) {
              streamingReasoningBufferRef.current = '';
            }

            finalizeTimerRef.current = null;
          }, STREAM_FINALIZE_DELAY_MS);
        },

        onError: (errorData) => {
          console.error('[SSE] Error:', errorData.message);
          setError(errorData.message);
          setIsLoading(false);
          isLoadingRef.current = false;
          abortControllerRef.current = null;
        },
      };

      try {
        await createSSEConnection(
          message.trim(),
          effectiveConvId,
          handlers,
          abortController.signal
        );
      } catch (sendError) {
        if (abortController.signal.aborted) {
          console.debug('[SSE] Connection aborted by user');
          return;
        }

        const errorMessage =
          sendError instanceof Error ? sendError.message : '发送消息失败';
        setError(errorMessage);
        setIsLoading(false);
        isLoadingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [clearFinalizeTimer, closeConnection, STREAM_FINALIZE_DELAY_MS, syncFinalAssistantMessage]
  );

  const abortStream = useCallback(async () => {
    clearFinalizeTimer();

    const currentMessageId = messageIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.debug('[Abort] HTTP connection aborted');
    }

    if (currentMessageId) {
      try {
        const success = await abortStreamGeneration(currentMessageId);
        if (success) {
          console.debug('[Abort] Backend stream generation stopped');
        } else {
          console.warn('[Abort] Backend task may have already ended');
        }
      } catch (abortError) {
        console.error('[Abort] Failed to call backend abort API:', abortError);
      }
    } else {
      console.warn('[Abort] Missing messageId, cannot call backend abort API');
    }

    if (streamingBufferRef.current || streamingReasoningBufferRef.current) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: streamingBufferRef.current,
        reasoning: streamingReasoningBufferRef.current || undefined,
        messageId: currentMessageId || undefined,
        conversationId: conversationIdRef.current || undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }

    setCurrentStreamingMessage('');
    setCurrentStreamingReasoning('');
    streamingBufferRef.current = '';
    streamingReasoningBufferRef.current = '';
    setIsLoading(false);
    isLoadingRef.current = false;
    setError(null);
    messageIdRef.current = null;
    setMessageId(null);
    abortControllerRef.current = null;
  }, [clearFinalizeTimer]);

  const clearMessages = useCallback(() => {
    clearFinalizeTimer();
    setMessages([]);
    setCurrentStreamingMessage('');
    setCurrentStreamingReasoning('');
    streamingBufferRef.current = '';
    streamingReasoningBufferRef.current = '';
    setError(null);
    setIsLoading(false);
    closeConnection();
  }, [clearFinalizeTimer, closeConnection]);

  const resetChatState = useCallback(() => {
    clearFinalizeTimer();
    closeConnection();
    setMessages([]);
    setCurrentStreamingMessage('');
    setCurrentStreamingReasoning('');
    streamingBufferRef.current = '';
    streamingReasoningBufferRef.current = '';
    setError(null);
    setIsLoading(false);
    isLoadingRef.current = false;
    setConversationId(null);
    conversationIdRef.current = null;
    setMessageId(null);
    messageIdRef.current = null;
    abortControllerRef.current = null;
  }, [clearFinalizeTimer, closeConnection]);

  const loadConversation = useCallback(async (id: number) => {
    try {
      const response = await getConversationMessages(id);
      if (response.code === 200 && response.data) {
        setMessages(response.data.map(toChatMessage));
        setConversationId(id);
      }
    } catch {
      setError('加载会话失败');
    }
  }, []);

  const recoverStream = useCallback(
    async (convId: number, currentMessageId: string, lastEventId?: string) => {
      clearFinalizeTimer();
      closeConnection();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setError(null);
      setMessageId(currentMessageId);
      messageIdRef.current = currentMessageId;
      conversationIdRef.current = convId;
      setConversationId(convId);

      setCurrentStreamingMessage('');
      setCurrentStreamingReasoning('');
      streamingBufferRef.current = '';
      streamingReasoningBufferRef.current = '';

      setIsLoading(true);
      isLoadingRef.current = true;

      const handlers: SSEHandlers = {
        onMessageId: (newMessageId) => {
          if (!messageIdRef.current) {
            messageIdRef.current = newMessageId;
            setMessageId(newMessageId);
            console.debug('[SSE Recover] Received messageId:', newMessageId);
          }
        },

        onChunk: (content) => {
          if (!content) {
            return;
          }

          streamingBufferRef.current += content;
          flushSync(() => {
            setCurrentStreamingMessage(streamingBufferRef.current);
          });
        },

        onReasoning: (reasoning) => {
          if (!reasoning) {
            return;
          }

          streamingReasoningBufferRef.current += reasoning;
          flushSync(() => {
            setCurrentStreamingReasoning(streamingReasoningBufferRef.current);
          });
        },

        onConversationId: (newConversationId) => {
          conversationIdRef.current = newConversationId;
          setConversationId(newConversationId);
          console.debug('[SSE Recover] Received conversationId:', newConversationId);
        },

        onDone: (data) => {
          console.debug('[SSE Recover] Stream completed, messageId:', data.messageId);

          if (streamingBufferRef.current || streamingReasoningBufferRef.current) {
            const assistantMessage: Message = {
              role: 'assistant',
              content: streamingBufferRef.current,
              reasoning: streamingReasoningBufferRef.current || undefined,
              messageId: data.messageId,
              conversationId: data.conversationId,
            };
            setMessages((prev) => [...prev, assistantMessage]);
          }

          setCurrentStreamingMessage('');
          setCurrentStreamingReasoning('');
          streamingBufferRef.current = '';
          streamingReasoningBufferRef.current = '';
          setIsLoading(false);
          isLoadingRef.current = false;
          abortControllerRef.current = null;
        },

        onError: (errorData) => {
          console.error('[SSE Recover] Error:', errorData.message);
          setError(errorData.message);
          setIsLoading(false);
          isLoadingRef.current = false;
          abortControllerRef.current = null;
        },
      };

      try {
        await recoverSSEConnection(
          convId,
          currentMessageId,
          lastEventId,
          handlers,
          abortController.signal
        );
      } catch (recoverError) {
        if (abortController.signal.aborted) {
          console.debug('[SSE Recover] Connection aborted by user');
          return;
        }

        const errorMessage =
          recoverError instanceof Error ? recoverError.message : '断线恢复失败';
        setError(errorMessage);
        setIsLoading(false);
        isLoadingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [clearFinalizeTimer, closeConnection]
  );

  useEffect(() => {
    return () => {
      clearFinalizeTimer();
      closeConnection();
    };
  }, [clearFinalizeTimer, closeConnection]);

  return {
    messages,
    currentStreamingMessage,
    currentStreamingReasoning,
    isLoading,
    error,
    conversationId,
    messageId,
    sendMessage,
    abortStream,
    clearMessages,
    resetChatState,
    setConversationId,
    loadConversation,
    recoverStream,
  };
}
