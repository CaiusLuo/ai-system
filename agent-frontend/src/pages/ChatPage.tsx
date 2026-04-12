import { useRef, useState, useEffect as useEffectHook, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSSEChat, Message } from '../hooks/useSSEChat';
import { useLocalChatStorage, getStoredConversations } from '../hooks/useLocalChatStorage';
import Sidebar from '../components/Sidebar';
import MessageBubble from '../components/MessageBubble';
import MessageSkeleton from '../components/MessageSkeleton';
import ChatInput from '../components/ChatInput';
import AdminPanel from './AdminPanel';
import { logout, getUserInfo, AUTH_PAGE_PATH } from '../services/auth';

// 本地消息转换为 Message 格式
function storedToMessage(msg: { role: string; content: string; reasoning?: string; timestamp?: number }): Message {
  return {
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    reasoning: msg.reasoning,
  };
}

export default function ChatPage() {
  const {
    messages: remoteMessages,
    currentStreamingMessage,
    currentStreamingReasoning,
    isLoading,
    error,
    conversationId: remoteConvId,
    sendMessage,
    abortStream,
    clearMessages,
    resetChatState,
    loadConversation,
  } = useSSEChat();

  const {
    getCurrentConvId,
    getCurrentConversation,
    getConversationList: getLocalConvList,
    createConversation,
    addMessage,
    deleteConversation: deleteLocalConv,
    switchConversation,
    syncBackendId,
    clearAll,
  } = useLocalChatStorage();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [localConversations, setLocalConversations] = useState<Array<{
    id: string;
    title: string;
    backendId: number | null;
    updatedAt: number;
    lastMessageContent: string | null;
    lastMessageTime: string | null;
  }>>([]);
  const [currentLocalConvId, setCurrentLocalConvId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [hasLoadedFromBackend, setHasLoadedFromBackend] = useState(false);
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userDisabled, setUserDisabled] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [agentName, setAgentName] = useState(() => {
    return localStorage.getItem('agent_name') || '助手';
  });
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [tempAgentName, setTempAgentName] = useState('');
  const useLocalMode = true;
  const navigate = useNavigate();
  const savedStreamingMessageRef = useRef<Set<string>>(new Set());
  
  // 智能滚动：用户手动滚动时不自动跟随
  const shouldAutoScrollRef = useRef(true);

  // 加载用户信息
  useEffectHook(() => {
    const userInfo = getUserInfo();
    if (userInfo) {
      setUsername(userInfo.username);
      setUserRole(userInfo.role);
      setUserDisabled(userInfo.status === 'DISABLED');
    }

    if (window.location.hash === '#admin' && userInfo?.role === 'ADMIN') {
      setShowAdminPanel(true);
    }
  }, []);

  // 加载本地对话列表
  const refreshLocalConvList = useCallback(() => {
    const list = getLocalConvList();
    setLocalConversations(list);
  }, [getLocalConvList]);

  useEffectHook(() => {
    refreshLocalConvList();
  }, [refreshLocalConvList]);

  // 加载当前本地对话的消息
  useEffectHook(() => {
    const conv = getCurrentConversation();
    if (conv) {
      setCurrentLocalConvId(getCurrentConvId());
      setLocalMessages(conv.messages.map(storedToMessage));

      const backendId = conv.backendId || conv.id;
      if (backendId && !hasLoadedFromBackend) {
        setHasLoadedFromBackend(true);
        loadConversation(Number(backendId)).then(() => {
          // loadConversation 会更新 remoteMessages
        }).catch(error => {
          console.warn('[ChatPage] 从后端加载消息失败，使用本地缓存:', error);
        });
      }
    } else {
      setCurrentLocalConvId(getCurrentConvId());
      setLocalMessages([]);
    }
  }, [getCurrentConvId, getCurrentConversation]);

  // 当 remoteMessages 更新时，同步到 localMessages
  useEffectHook(() => {
    if (hasLoadedFromBackend && remoteMessages.length > 0) {
      setLocalMessages(remoteMessages);
    }
  }, [remoteMessages, hasLoadedFromBackend]);

  // 流式输出完成时保存消息到本地
  useEffectHook(() => {
    if (!isLoading && (currentStreamingMessage || currentStreamingReasoning)) {
      const messageKey = currentStreamingMessage.substring(0, 50);

      if (!savedStreamingMessageRef.current.has(messageKey)) {
        savedStreamingMessageRef.current.add(messageKey);

        if (useLocalMode) {
          addMessage({
            role: 'assistant',
            content: currentStreamingMessage,
            reasoning: currentStreamingReasoning || undefined,
          });
          refreshLocalConvList();

          setLocalMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === currentStreamingMessage) {
              return prev;
            }
            return [...prev, {
              role: 'assistant' as const,
              content: currentStreamingMessage,
              reasoning: currentStreamingReasoning || undefined,
            }];
          });
        }
      }
    }

    if (isLoading && currentStreamingMessage === '') {
      savedStreamingMessageRef.current.clear();
    }
  }, [isLoading, currentStreamingMessage, currentStreamingReasoning, useLocalMode, addMessage, refreshLocalConvList]);

  // 发送消息
  const handleSend = (message: string) => {
    if (isLoading) return;
    if (userDisabled) {
      console.warn('[Chat] User is disabled, cannot send message');
      return;
    }

    if (useLocalMode) {
      const userMsg: Message = { role: 'user', content: message };
      setLocalMessages(prev => [...prev, userMsg]);
      addMessage({ role: 'user', content: message });

      if (!getCurrentConvId()) {
        createConversation(message);
      }
    }

    sendMessage(message, remoteConvId || undefined);
    
    // 发送消息后恢复自动滚动
    shouldAutoScrollRef.current = true;
  };

  // 新建对话
  const handleNewConversation = () => {
    if (isLoading) return;
    if (userDisabled) {
      console.warn('[Chat] User is disabled, cannot create new conversation');
      return;
    }

    if (useLocalMode) {
      createConversation();
      setLocalMessages([]);
      setHasLoadedFromBackend(false);
      refreshLocalConvList();
    } else {
      clearMessages();
    }
    setIsMobileSidebarOpen(false);
  };

  // 选择本地对话
  const handleSelectConversation = useCallback(async (id: number | string) => {
    if (isLoading) return;

    setIsSwitchingConversation(true);
    setHasLoadedFromBackend(false);

    try {
      switchConversation(id as string);

      const convId = id as string;
      const convs = getStoredConversations();
      const conv = convs[convId];

      if (conv) {
        const msgs: Message[] = conv.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          reasoning: msg.reasoning,
        }));
        setLocalMessages(msgs);

        const backendId = conv.backendId || conv.id;
        if (backendId) {
          try {
            await loadConversation(Number(backendId));
            setHasLoadedFromBackend(true);
          } catch (error) {
            console.warn('[ChatPage] 从后端加载消息失败，使用本地缓存:', error);
          }
        }
      } else {
        setLocalMessages([]);
      }

      setCurrentLocalConvId(convId);
    } finally {
      setIsSwitchingConversation(false);
    }

    setIsMobileSidebarOpen(false);
  }, [isLoading, switchConversation, loadConversation]);

  // 删除本地对话
  const handleDeleteConversation = async (id: number | string) => {
    if (isLoading) return;

    const convId = id as string;
    const isCurrentConv = getCurrentConvId() === convId;

    deleteLocalConv(convId);

    if (isCurrentConv) {
      setLocalMessages([]);
      setCurrentLocalConvId(null);
    }

    refreshLocalConvList();
  };

  // 拖拽排序对话
  const handleReorderConversations = useCallback((orderedIds: string[]) => {
    const convs = getStoredConversations();
    const orderedConvs: Record<string, any> = {};
    orderedIds.forEach(id => {
      if (convs[id]) {
        orderedConvs[id] = convs[id];
      }
    });

    try {
      localStorage.setItem('chat_conversations', JSON.stringify(orderedConvs));
      refreshLocalConvList();
    } catch (error) {
      console.error('[ChatPage] 保存对话排序失败:', error);
    }
  }, [refreshLocalConvList]);

  // 同步后端 ID
  useEffectHook(() => {
    if (remoteConvId && currentLocalConvId) {
      syncBackendId(currentLocalConvId, remoteConvId);
    }
  }, [remoteConvId, currentLocalConvId, syncBackendId]);

  const handleLogout = async () => {
    if (isLoading) {
      await abortStream();
    }

    savedStreamingMessageRef.current.clear();
    clearAll();
    resetChatState();
    setLocalMessages([]);
    setLocalConversations([]);
    setCurrentLocalConvId(null);
    setHasLoadedFromBackend(false);

    logout();
    navigate(AUTH_PAGE_PATH, { replace: true });
  };

  const showAdminEntry = userRole === 'ADMIN';

  // 统一数据源逻辑
  const displayMessages = useMemo<Message[]>(() => {
    const baseMessages = [...localMessages];

    if (currentStreamingMessage || currentStreamingReasoning) {
      const lastMsg = baseMessages[baseMessages.length - 1];
      const hasStreamingAssistant = lastMsg && lastMsg.role === 'assistant' && isLoading;

      if (hasStreamingAssistant) {
        baseMessages[baseMessages.length - 1] = {
          ...lastMsg,
          content: currentStreamingMessage,
          reasoning: currentStreamingReasoning || lastMsg.reasoning,
        };
      } else {
        baseMessages.push({
          role: 'assistant',
          content: currentStreamingMessage,
          reasoning: currentStreamingReasoning || undefined,
        });
      }
    }

    return baseMessages;
  }, [localMessages, currentStreamingMessage, currentStreamingReasoning, isLoading]);

  // 智能滚动：检测用户是否手动滚动
  useEffectHook(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      // 如果滚动到底部附近，恢复自动滚动
      shouldAutoScrollRef.current = isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 自动滚动到底部（仅在应该自动滚动时）
  useEffectHook(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages, currentStreamingMessage]);

  const handleOpenAdmin = () => {
    setShowAdminPanel(true);
  };

  const handleCloseAdmin = () => {
    setShowAdminPanel(false);
  };

  // 管理员面板
  if (showAdminPanel) {
    return <AdminPanel onBack={handleCloseAdmin} />;
  }

  const hasMessages = displayMessages.length > 0;
  const currentTitle = getCurrentConvId() 
    ? localConversations.find(c => c.id === getCurrentConvId())?.title 
    : null;

  return (
    <div className="h-screen flex bg-white dark:bg-gray-900">
      {/* 侧边栏 */}
      <Sidebar
        localConversations={localConversations}
        currentLocalConvId={currentLocalConvId}
        onSelectLocalConversation={handleSelectConversation}
        onDeleteLocalConversation={handleDeleteConversation}
        onReorderConversations={handleReorderConversations}
        onNewConversation={handleNewConversation}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        username={username}
        showAdminEntry={showAdminEntry}
        onOpenAdmin={handleOpenAdmin}
        onLogout={handleLogout}
        canCreateConversation={!userDisabled}
        onOpenAgentSettings={() => {
          setTempAgentName(agentName);
          setShowAgentSettings(true);
        }}
        agentName={agentName}
      />

      {/* 主聊天区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶部导航栏（极简） */}
        {hasMessages && (
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h1 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                  {currentTitle || '新对话'}
                </h1>
                {isLoading && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 mt-0.5">
                    <span className="inline-block w-1 h-1 bg-gray-400 rounded-full animate-pulse" />
                    生成中...
                  </p>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <button
              onClick={() => {
                if (useLocalMode) {
                  const convId = getCurrentConvId();
                  if (convId) deleteLocalConv(convId);
                } else {
                  clearMessages();
                }
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              title="清空对话"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </header>
        )}

        {/* 消息列表区域 */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto scrollbar-thin bg-white dark:bg-gray-900"
        >
          {isSwitchingConversation ? (
            <div className="max-w-3xl mx-auto px-4 py-12">
              <MessageSkeleton count={3} />
            </div>
          ) : !hasMessages ? (
            // 空状态（极简）
            <div className="h-full flex items-center justify-center">
              <div className="text-center px-4 max-w-lg">
                <h2 className="text-2xl font-normal text-gray-900 dark:text-gray-100 mb-3">
                  有什么可以帮你的？
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                  输入你的问题，开始对话
                </p>
              </div>
            </div>
          ) : (
            // 消息列表
            <div className="pb-4">
              {displayMessages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  isStreaming={idx === displayMessages.length - 1 && isLoading}
                  agentName={agentName}
                />
              ))}

              {/* 加载指示器（极简） */}
              {isLoading && currentStreamingMessage === '' && (
                <div className="max-w-3xl mx-auto px-4 py-6">
                  <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[typing_1s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[typing_1s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[typing_1s_ease-in-out_infinite]" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* 输入区域 */}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          onStop={abortStream}
          disabled={userDisabled}
          placeholder={hasMessages ? '回复...' : '输入你的问题...'}
          autoFocus={!hasMessages}
        />
      </main>

      {/* Agent 设置弹窗（极简） */}
      {showAgentSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-sm mx-4">
            <div className="p-5">
              <h2 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Agent 名称</h2>
              <input
                type="text"
                value={tempAgentName}
                onChange={(e) => {
                  setTempAgentName(e.target.value.trim());
                }}
                maxLength={20}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
                placeholder="输入名称"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                此名称将显示在消息旁边
              </p>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => {
                  setTempAgentName('助手');
                }}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                重置
              </button>
              <button
                onClick={() => {
                  if (tempAgentName) {
                    setAgentName(tempAgentName);
                    localStorage.setItem('agent_name', tempAgentName);
                  }
                  setShowAgentSettings(false);
                }}
                className="px-4 py-2 text-sm text-white bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 rounded-lg transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
