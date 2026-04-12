import { useState, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { createSSEConnection, SSEHandlers, SEDoneData, SEEErrorData } from '../services/sse';
import { abortStreamGeneration } from '../services/sseAbort';
import { recoverSSEConnection } from '../services/sseRecover';
import { getConversationMessages } from '../services/conversation';
import { Message, MessageDTO } from '../types';

export type { Message };

interface UseSSEChatReturn {
  messages: Message[];
  currentStreamingMessage: string;
  currentStreamingReasoning: string;
  isLoading: boolean;
  error: string | null;
  conversationId: number | null; // 当前会话 ID
  messageId: string | null; // 当前消息 ID（用于 abort）
  sendMessage: (message: string, conversationId?: number) => void;
  abortStream: () => void;
  clearMessages: () => void;
  resetChatState: () => void;
  setConversationId: (id: number | null) => void; // 手动设置会话 ID
  loadConversation: (id: number) => Promise<void>; // 加载历史消息
  recoverStream: (conversationId: number, messageId: string, lastEventId?: string) => void; // 断线恢复
}

/**
 * SSE 聊天核心 Hook
 * 管理消息状态、SSE 连接、流式输出、会话管理
 */
export function useSSEChat(): UseSSEChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');
  const [currentStreamingReasoning, setCurrentStreamingReasoning] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdRef = useRef<string | null>(null); // 存储当前 messageId
  const streamingBufferRef = useRef('');
  const streamingReasoningBufferRef = useRef('');

  // 关闭当前 SSE 连接（通过 AbortController）
  const closeConnection = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (message: string, conversationId?: number) => {
    if (!message.trim() || isLoading) return;

    // 清除之前的连接
    closeConnection();

    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 清除之前的错误和流式消息
    setError(null);
    setCurrentStreamingMessage('');
    streamingBufferRef.current = '';
    setMessageId(null);
    messageIdRef.current = null;

    // 添加用户消息
    const userMessage: Message = { role: 'user', content: message.trim() };
    setMessages((prev) => [...prev, userMessage]);

    // 设置加载状态
    setIsLoading(true);

    // 创建 SSE 处理器
    const handlers: SSEHandlers = {
      onMessageId: (newMessageId: string) => {
        // 保存 messageId（只在首次设置）
        if (!messageIdRef.current) {
          messageIdRef.current = newMessageId;
          setMessageId(newMessageId);
          console.debug('[SSE] Received messageId:', newMessageId);
        }
      },

      onChunk: (content: string, _index: number) => {
        // 累加 chunk 内容
        streamingBufferRef.current += content;
        // 使用 flushSync 确保立即渲染，打破 React 批处理
        flushSync(() => {
          setCurrentStreamingMessage(streamingBufferRef.current);
        });
      },

      onReasoning: (reasoning: string, _index: number) => {
        // 累加思考过程
        streamingReasoningBufferRef.current += reasoning;
        // 使用 flushSync 确保立即渲染
        flushSync(() => {
          setCurrentStreamingReasoning(streamingReasoningBufferRef.current);
        });
      },

      onConversationId: (newConversationId: number) => {
        // 保存首次返回的 conversationId
        setConversationId(newConversationId);
        console.debug('[SSE] Received conversationId:', newConversationId);
      },

      onDone: (data: SEDoneData) => {
        console.debug('[SSE] Stream completed, messageId:', data.messageId);

        // 将流式消息添加到消息列表
        if (streamingBufferRef.current || streamingReasoningBufferRef.current) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: streamingBufferRef.current,
            reasoning: streamingReasoningBufferRef.current || undefined,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        // 清理状态
        setCurrentStreamingMessage('');
        setCurrentStreamingReasoning('');
        streamingBufferRef.current = '';
        streamingReasoningBufferRef.current = '';
        setIsLoading(false);
        abortControllerRef.current = null;
      },

      onError: (errorData: SEEErrorData) => {
        console.error('[SSE] Error:', errorData.message);
        setError(errorData.message);
        setIsLoading(false);
        abortControllerRef.current = null;
      },
    };

    try {
      // 启动 SSE 连接
      await createSSEConnection(
        message.trim(),
        conversationId,
        handlers,
        abortController.signal
      );
    } catch (err) {
      // 如果是因为 abort 导致的错误，忽略
      if (abortController.signal.aborted) {
        console.debug('[SSE] Connection aborted by user');
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : '发送消息失败';
      setError(errorMessage);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, closeConnection]);

  // 中止当前的流式输出
  const abortStream = useCallback(async () => {
    const currentMessageId = messageIdRef.current;
    
    // 1. 先中断 HTTP 连接
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.debug('[Abort] HTTP connection aborted');
    }

    // 2. 调用后端 abort 接口（确保后端也停止处理）
    if (currentMessageId) {
      try {
        const success = await abortStreamGeneration(currentMessageId);
        if (success) {
          console.debug('[Abort] Backend stream generation stopped');
        } else {
          console.warn('[Abort] Backend task may have already ended');
        }
      } catch (error) {
        console.error('[Abort] Failed to call backend abort API:', error);
      }
    } else {
      console.warn('[Abort] Missing messageId, cannot call backend abort API');
    }

    // 将当前已接收的内容添加到消息列表
    if (streamingBufferRef.current || streamingReasoningBufferRef.current) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: streamingBufferRef.current,
        reasoning: streamingReasoningBufferRef.current || undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }

    setCurrentStreamingMessage('');
    setCurrentStreamingReasoning('');
    streamingBufferRef.current = '';
    streamingReasoningBufferRef.current = '';
    setIsLoading(false);
    setError(null);
    messageIdRef.current = null;
    setMessageId(null);
  }, []);

  // 清空所有消息
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentStreamingMessage('');
    setCurrentStreamingReasoning('');
    streamingBufferRef.current = '';
    streamingReasoningBufferRef.current = '';
    setError(null);
    setIsLoading(false);
    closeConnection();
    // 注意：不清除 conversationId，以便用户可以继续在同一会话中对话
  }, [closeConnection]);

  const resetChatState = useCallback(() => {
    closeConnection();
    setMessages([]);
    setCurrentStreamingMessage('');
    setCurrentStreamingReasoning('');
    streamingBufferRef.current = '';
    streamingReasoningBufferRef.current = '';
    setError(null);
    setIsLoading(false);
    setConversationId(null);
    setMessageId(null);
    messageIdRef.current = null;
    abortControllerRef.current = null;
  }, [closeConnection]);

  // 加载历史消息
  const loadConversation = useCallback(async (id: number) => {
    try {
      const response = await getConversationMessages(id);
      if (response.code === 200 && response.data) {
        // 将后端返回的 MessageDTO 转换为前端 Message 格式
        const msgs: Message[] = response.data.map((msg: MessageDTO) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          userId: msg.userId,
          username: msg.username,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          title: msg.title,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        }));
        setMessages(msgs);
        setConversationId(id);
      }
    } catch (err) {
      setError('加载会话失败');
    }
  }, []);

  // 断线恢复
  const recoverStream = useCallback(async (conversationId: number, messageId: string, lastEventId?: string) => {
    // 清除之前的连接
    closeConnection();

    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 清除之前的错误
    setError(null);
    setMessageId(messageId);
    messageIdRef.current = messageId;

    // 设置加载状态
    setIsLoading(true);

    // 创建 SSE 处理器
    const handlers: SSEHandlers = {
      onMessageId: (newMessageId: string) => {
        if (!messageIdRef.current) {
          messageIdRef.current = newMessageId;
          setMessageId(newMessageId);
          console.debug('[SSE Recover] Received messageId:', newMessageId);
        }
      },

      onChunk: (content: string, _index: number) => {
        streamingBufferRef.current += content;
        flushSync(() => {
          setCurrentStreamingMessage(streamingBufferRef.current);
        });
      },

      onReasoning: (reasoning: string, _index: number) => {
        streamingReasoningBufferRef.current += reasoning;
        flushSync(() => {
          setCurrentStreamingReasoning(streamingReasoningBufferRef.current);
        });
      },

      onConversationId: (newConversationId: number) => {
        setConversationId(newConversationId);
        console.debug('[SSE Recover] Received conversationId:', newConversationId);
      },

      onDone: (data: SEDoneData) => {
        console.debug('[SSE Recover] Stream completed, messageId:', data.messageId);

        if (streamingBufferRef.current || streamingReasoningBufferRef.current) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: streamingBufferRef.current,
            reasoning: streamingReasoningBufferRef.current || undefined,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        setCurrentStreamingMessage('');
        setCurrentStreamingReasoning('');
        streamingBufferRef.current = '';
        streamingReasoningBufferRef.current = '';
        setIsLoading(false);
        abortControllerRef.current = null;
      },

      onError: (errorData: SEEErrorData) => {
        console.error('[SSE Recover] Error:', errorData.message);
        setError(errorData.message);
        setIsLoading(false);
        abortControllerRef.current = null;
      },
    };

    try {
      await recoverSSEConnection(
        conversationId,
        messageId,
        lastEventId,
        handlers,
        abortController.signal
      );
    } catch (err) {
      if (abortController.signal.aborted) {
        console.debug('[SSE Recover] Connection aborted by user');
        return;
      }

      const errorMessage = err instanceof Error ? err.message : '断线恢复失败';
      setError(errorMessage);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [closeConnection]);

  // 组件卸载时关闭连接
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

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
