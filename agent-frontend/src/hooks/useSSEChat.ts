import { useState, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { createSSEConnection, SSEHandlers, SEDoneData, SEEErrorData } from '../services/sse';
import { getConversationMessages, Message as ConversationMessage } from '../services/conversation';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string; // 思考过程内容
}

interface UseSSEChatReturn {
  messages: Message[];
  currentStreamingMessage: string;
  currentStreamingReasoning: string;
  isLoading: boolean;
  error: string | null;
  conversationId: number | null; // 当前会话 ID
  sendMessage: (message: string, conversationId?: number) => void;
  abortStream: () => void;
  clearMessages: () => void;
  setConversationId: (id: number | null) => void; // 手动设置会话 ID
  loadConversation: (id: number) => Promise<void>; // 加载历史消息
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

  const abortControllerRef = useRef<AbortController | null>(null);
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

    // 添加用户消息
    const userMessage: Message = { role: 'user', content: message.trim() };
    setMessages((prev) => [...prev, userMessage]);

    // 设置加载状态
    setIsLoading(true);

    // 创建 SSE 处理器
    const handlers: SSEHandlers = {
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
        console.debug('[SSE] Stream completed, total_tokens:', data.total_tokens);

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
  const abortStream = useCallback(() => {
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
    closeConnection();
  }, [closeConnection]);

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

  // 加载历史消息
  const loadConversation = useCallback(async (id: number) => {
    try {
      const response = await getConversationMessages(id);
      if (response.code === 200 && response.data) {
        const msgs: Message[] = response.data.map((msg: ConversationMessage) => ({
          role: msg.role,
          content: msg.content,
        }));
        setMessages(msgs);
        setConversationId(id);
      }
    } catch (err) {
      console.error('[Chat] Failed to load conversation:', err);
      setError('加载会话失败');
    }
  }, []);

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
    sendMessage,
    abortStream,
    clearMessages,
    setConversationId,
    loadConversation,
  };
}
