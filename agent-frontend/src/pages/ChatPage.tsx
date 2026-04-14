import { useRef, useState, useEffect as useEffectHook, useMemo, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSSEChat } from '../hooks/useSSEChat';
import { useLocalChatStorage, getStoredConversations } from '../hooks/useLocalChatStorage';
import Sidebar from '../components/Sidebar';
import MessageBubble from '../components/MessageBubble';
import MessageSkeleton from '../components/MessageSkeleton';
import ChatInput from '../components/ChatInput';
import AdminPanel from './AdminPanel';
import { useDynamicViewportHeight } from '../hooks/useDynamicViewportHeight';
import { logout, getCurrentUser, getUserInfo, AUTH_PAGE_PATH } from '../services/auth';
import {
  getConversationList,
  deleteConversation as deleteRemoteConversation,
  type ConversationDTO,
} from '../services/conversation';
import { CHAT_CONVERSATIONS_KEY } from '../services/chatStorage';
import type {
  LocalConversationSummary,
  Message,
  StoredConversationMap,
  StoredMessage,
} from '../types';
import { EmptyStateMotion, SoftGridMotion } from '../remotion';

// 本地消息转换为 Message 格式
function storedToMessage(msg: StoredMessage): Message {
  return {
    role: msg.role,
    content: msg.content,
    reasoning: msg.reasoning,
  };
}

function normalizeLastMessageTime(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function mergeBackendConversations(
  storedConversations: StoredConversationMap,
  remoteConversations: ConversationDTO[]
): { nextConversations: StoredConversationMap; changed: boolean } {
  const localKeyByBackendId = new Map<number, string>();

  for (const [localKey, conversation] of Object.entries(storedConversations)) {
    const backendId = conversation.backendId ?? conversation.id ?? undefined;
    if (typeof backendId === 'number') {
      localKeyByBackendId.set(backendId, localKey);
    }
  }

  const nextConversations: StoredConversationMap = { ...storedConversations };
  let changed = false;
  const now = Date.now();

  for (const remoteConversation of remoteConversations) {
    const backendId = remoteConversation.id;
    const createdAt = Date.parse(remoteConversation.createdAt);
    const updatedAt = Date.parse(remoteConversation.updatedAt);
    const localKey = localKeyByBackendId.get(backendId) ?? `server_${backendId}`;
    const existing = nextConversations[localKey];

    if (existing) {
      nextConversations[localKey] = {
        ...existing,
        id: backendId,
        backendId,
        title: remoteConversation.title || existing.title,
        lastMessageContent: remoteConversation.lastMessageContent,
        lastMessageTime: normalizeLastMessageTime(remoteConversation.lastMessageTime),
        createdAt: Number.isFinite(existing.createdAt)
          ? existing.createdAt
          : Number.isFinite(createdAt)
            ? createdAt
            : now,
        updatedAt: Number.isFinite(updatedAt)
          ? updatedAt
          : existing.updatedAt,
      };
      changed = true;
    } else {
      nextConversations[localKey] = {
        id: backendId,
        backendId,
        title: remoteConversation.title || '新对话',
        messages: [],
        lastMessageContent: remoteConversation.lastMessageContent,
        lastMessageTime: normalizeLastMessageTime(remoteConversation.lastMessageTime),
        createdAt: Number.isFinite(createdAt) ? createdAt : now,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : now,
      };
      changed = true;
    }
  }

  return { nextConversations, changed };
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
  const [localConversations, setLocalConversations] = useState<LocalConversationSummary[]>([]);
  const [currentLocalConvId, setCurrentLocalConvId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [hasLoadedFromBackend, setHasLoadedFromBackend] = useState(false);
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userDisabled, setUserDisabled] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [agentName, setAgentName] = useState(() => {
    return localStorage.getItem('agent_name') || '工作台';
  });
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [tempAgentName, setTempAgentName] = useState('');
  const useLocalMode = true;
  const navigate = useNavigate();
  const viewportHeight = useDynamicViewportHeight();
  const savedStreamingMessageRef = useRef<Set<string>>(new Set());
  
  // 智能滚动：用户手动滚动时不自动跟随
  const shouldAutoScrollRef = useRef(true);

  const mergeBackendConversationsToLocal = useCallback((remoteConversations: ConversationDTO[]) => {
    const storedConversations = getStoredConversations();
    const { nextConversations, changed } = mergeBackendConversations(
      storedConversations,
      remoteConversations
    );

    if (changed) {
      try {
        localStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(nextConversations));
      } catch (storageError) {
        console.warn('[ChatPage] 写入本地会话缓存失败:', storageError);
      }
      setLocalConversations(getLocalConvList());
    }
  }, [getLocalConvList]);

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

  useEffectHook(() => {
    const syncAdminPanelByHash = () => {
      if (window.location.hash === '#admin' && userRole === 'ADMIN') {
        setShowAdminPanel(true);
      } else if (window.location.hash !== '#admin') {
        setShowAdminPanel(false);
      }
    };

    syncAdminPanelByHash();
    window.addEventListener('hashchange', syncAdminPanelByHash);

    return () => {
      window.removeEventListener('hashchange', syncAdminPanelByHash);
    };
  }, [userRole]);

  useEffectHook(() => {
    const bootstrapFromBackend = async () => {
      try {
        const me = await getCurrentUser();
        if (me.code === 200 && me.data) {
          setUsername(me.data.username);
          setUserRole(me.data.role);
          setUserDisabled(me.data.status === 0 || me.data.statusText === 'DISABLED');
        }
      } catch (error) {
        console.warn('[ChatPage] 获取当前用户信息失败，继续使用本地缓存:', error);
      }

      try {
        const response = await getConversationList();
        if (response.code === 200 && response.data) {
          mergeBackendConversationsToLocal(response.data);
        }
      } catch (error) {
        console.warn('[ChatPage] 获取后端会话列表失败，继续使用本地缓存:', error);
      }
    };

    void bootstrapFromBackend();
  }, [mergeBackendConversationsToLocal]);

  // 移动端侧边栏打开时，锁定 body 滚动，避免背景穿透
  useEffectHook(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileSidebarOpen]);

  // 桌面端下自动关闭移动抽屉状态，避免断点切换后状态残留
  useEffectHook(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileSidebarOpen(false);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
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

  // 当 remoteMessages 更新时，同步到 localMessages（流式传输中不覆盖，避免丢失流式内容）
  useEffectHook(() => {
    if (hasLoadedFromBackend && remoteMessages.length > 0 && !isLoading) {
      setLocalMessages(remoteMessages);
    }
  }, [remoteMessages, hasLoadedFromBackend, isLoading]);

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
      resetChatState();
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

    // 清理旧的流状态和 SSE 连接
    resetChatState();

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
  }, [isLoading, switchConversation, loadConversation, resetChatState]);

  // 删除本地对话
  const handleDeleteConversation = async (id: number | string) => {
    if (isLoading) return;

    const convId = id as string;
    const isCurrentConv = getCurrentConvId() === convId;

    const conversations = getStoredConversations();
    const conversation = conversations[convId];
    const backendId = conversation?.backendId ?? conversation?.id;

    if (typeof backendId === 'number') {
      try {
        await deleteRemoteConversation(backendId);
      } catch (error) {
        console.error('[ChatPage] 删除后端会话失败，已中止本地删除:', error);
        return;
      }
    }

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
    const orderedConvs: StoredConversationMap = {};
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

    // 只有当有实际内容时才追加/更新流式消息，防止 undefined 被渲染
    const streamingContent = currentStreamingMessage || '';
    const reasoningContent = currentStreamingReasoning || '';

    if (streamingContent || reasoningContent) {
      const lastMsg = baseMessages[baseMessages.length - 1];
      const hasStreamingAssistant = lastMsg && lastMsg.role === 'assistant' && isLoading;
      const isSameAsLastAssistant =
        !!lastMsg &&
        lastMsg.role === 'assistant' &&
        lastMsg.content === streamingContent &&
        (reasoningContent ? (lastMsg.reasoning || '') === reasoningContent : true);

      if (hasStreamingAssistant) {
        baseMessages[baseMessages.length - 1] = {
          ...lastMsg,
          content: streamingContent,
          reasoning: reasoningContent || lastMsg.reasoning,
        };
      } else if (!isSameAsLastAssistant) {
        baseMessages.push({
          role: 'assistant',
          content: streamingContent,
          reasoning: reasoningContent || undefined,
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
      messagesEndRef.current?.scrollIntoView({
        behavior: isLoading ? 'auto' : 'smooth',
        block: 'end',
      });
    }
  }, [displayMessages, currentStreamingMessage, isLoading]);

  const handleOpenAdmin = () => {
    if (window.location.hash !== '#admin') {
      history.replaceState({ adminPanel: true }, '', '#admin');
    }
    setShowAdminPanel(true);
    setIsMobileSidebarOpen(false);
  };

  const handleCloseAdmin = () => {
    if (window.location.hash === '#admin') {
      history.replaceState({}, '', window.location.pathname);
    }
    setShowAdminPanel(false);
  };

  // 管理员面板
  if (showAdminPanel) {
    return <AdminPanel onBack={handleCloseAdmin} />;
  }

  const hasMessages = displayMessages.length > 0;
  const currentConvId = currentLocalConvId ?? getCurrentConvId();
  const currentTitle = currentConvId
    ? localConversations.find(c => c.id === currentConvId)?.title
    : null;
  const shellStyle = useMemo<CSSProperties | undefined>(() => {
    return viewportHeight > 0
      ? { height: `${Math.round(viewportHeight)}px` }
      : undefined;
  }, [viewportHeight]);

  const handleOpenProfile = () => {
    // 预留：后续接入用户个人资料页
  };

  return (
    <div
      className="relative flex h-screen w-full overflow-hidden bg-[var(--app-canvas)] text-[var(--text-primary)] supports-[height:100dvh]:h-[100dvh]"
      style={shellStyle}
    >
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 顶部导航栏 */}
        <header className="relative shrink-0 border-b border-[var(--border-subtle)] bg-[rgba(247,247,245,0.88)] backdrop-blur-sm">
          <SoftGridMotion className="pointer-events-none absolute inset-0" opacity={0.18} />
          <div
            className="relative flex items-center justify-between gap-2 px-3 pb-2.5 pt-2 sm:px-4"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)] lg:hidden"
                aria-label="打开会话列表"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-medium text-[var(--text-primary)] sm:max-w-xs">
                  {currentTitle || '未命名会话'}
                </h1>
                {isLoading ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[var(--accent-500)]" />
                    正在处理...
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {hasMessages ? '继续当前会话' : '创建第一条会话'}
                  </p>
                )}
              </div>
            </div>

            {/* 个人资料入口（预留） */}
            <button
              onClick={handleOpenProfile}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-transparent px-2.5 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
              title="个人资料（即将上线）"
              aria-label="查看个人资料"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs font-medium text-[var(--text-secondary)]">
                {(username || '用户').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline">账户</span>
            </button>
          </div>
        </header>

        {/* 消息列表区域 */}
        <div
          ref={chatContainerRef}
          className="scrollbar-thin flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[var(--app-canvas)]"
        >
          {isSwitchingConversation ? (
            <div className="mx-auto max-w-4xl px-3 py-12 sm:px-4">
              <MessageSkeleton count={3} />
            </div>
          ) : !hasMessages ? (
            <div className="flex h-full items-center justify-center px-4">
              <div className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-10 text-center shadow-[var(--shadow-soft)] sm:px-10">
                <div className="pointer-events-none absolute inset-0">
                  <EmptyStateMotion className="absolute inset-0" opacity={0.5} />
                </div>
                <div className="relative">
                  <h2 className="mb-3 text-[1.6rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                    开始管理你的求职会话
                  </h2>
                  <p className="mb-1 text-sm text-[var(--text-secondary)]">
                    先输入一个目标岗位或简历准备问题，逐步记录你的求职进度。
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">例如：整理前端岗位投递优先级</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="pb-2 pt-1 sm:pb-4">
              {displayMessages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  isStreaming={idx === displayMessages.length - 1 && isLoading}
                />
              ))}

              {isLoading && !currentStreamingMessage && (
                <div className="mx-auto max-w-4xl px-3 py-5 sm:px-4 sm:py-6">
                  <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-muted)]">
                    <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent-500)]" />
                    正在整理回复...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-3 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 sm:mx-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 输入区域 */}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          onStop={abortStream}
          disabled={userDisabled}
          placeholder={hasMessages ? '继续输入...' : '输入岗位、简历或投递相关问题...'}
          autoFocus={!hasMessages}
        />
      </main>

      {showAgentSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/28 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
            <div className="p-5">
              <h2 className="mb-4 text-base font-medium text-[var(--text-primary)]">工作台显示名称</h2>
              <input
                type="text"
                value={tempAgentName}
                onChange={(e) => {
                  setTempAgentName(e.target.value.trim());
                }}
                maxLength={20}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-200)]"
                placeholder="输入名称"
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                该名称将显示在侧边栏设置区域
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] p-4">
              <button
                onClick={() => {
                  setTempAgentName('工作台');
                }}
                className="px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
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
                className="btn-primary px-4 py-2 text-sm"
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
