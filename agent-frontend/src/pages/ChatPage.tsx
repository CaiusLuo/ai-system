import { useRef, useState, useEffect as useEffectHook, useMemo, useCallback, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSSEChat } from '../hooks/useSSEChat';
import { useLocalChatStorage } from '../hooks/useLocalChatStorage';
import Sidebar from '../components/Sidebar';
import MessageBubble from '../components/MessageBubble';
import MessageSkeleton from '../components/MessageSkeleton';
import ChatInput from '../components/ChatInput';
import AdminPanel from './AdminPanel';
import UserProfileModal from '../components/UserProfileModal';
import { useDynamicViewportHeight } from '../hooks/useDynamicViewportHeight';
import { logout, getCurrentUser, getStoredCurrentUser, AUTH_PAGE_PATH } from '../services/auth';
import {
  getConversationList,
  deleteConversation as deleteRemoteConversation,
} from '../services/conversation';
import { uploadAvatar as uploadAvatarFile, uploadDocument } from '../services/storage';
import { getResumeList, type Resume } from '../services/resume';
import type {
  LocalConversationSummary,
  Message,
  StoredCurrentUser,
  StoredMessage,
} from '../types';

// 本地消息转换为 Message 格式
function storedToMessage(msg: StoredMessage): Message {
  return {
    role: msg.role,
    content: msg.content,
    reasoning: msg.reasoning,
  };
}

function getMessageRenderKey(message: Message, index: number): string {
  if (message.messageId) {
    return `message-${message.messageId}`;
  }

  if (message.id) {
    return `message-${message.id}`;
  }

  if (message.createdAt) {
    return `message-${message.role}-${message.createdAt}`;
  }

  return `message-${message.role}-${index}-${message.content.slice(0, 32)}`;
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
    getConversationById,
    getConversationList: getLocalConvList,
    createConversation,
    addMessage,
    deleteConversation: deleteLocalConv,
    switchConversation,
    syncBackendId,
    mergeRemoteConversations,
    reorderConversations,
    clearAll,
  } = useLocalChatStorage();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const optimisticConversationIdRef = useRef<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [localConversations, setLocalConversations] = useState<LocalConversationSummary[]>([]);
  const [currentLocalConvId, setCurrentLocalConvId] = useState<string | null>(() => getCurrentConvId());
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [hasLoadedFromBackend, setHasLoadedFromBackend] = useState(false);
  const [currentUser, setCurrentUser] = useState<StoredCurrentUser | null>(() => getStoredCurrentUser());
  const [agentName, setAgentName] = useState(() => {
    return localStorage.getItem('agent_name') || '工作台';
  });
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [tempAgentName, setTempAgentName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [uploadedResumes, setUploadedResumes] = useState<Resume[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<number | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const activeResume = useMemo(() => {
    return uploadedResumes.find(r => r.id === activeResumeId) || null;
  }, [uploadedResumes, activeResumeId]);
  const useLocalMode = true;
  const navigate = useNavigate();
  const location = useLocation();
  const viewportHeight = useDynamicViewportHeight();
  const savedStreamingMessageRef = useRef<Set<string>>(new Set());
  
  // 智能滚动：用户手动滚动时不自动跟随
  const shouldAutoScrollRef = useRef(true);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const profileUser =
    currentUser?.status !== undefined && currentUser?.statusText !== undefined
      ? currentUser
      : null;
  const username = profileUser?.username ?? '';
  const userRole = currentUser?.role ?? '';
  const userDisabled = profileUser?.status === 0 || profileUser?.statusText === 'DISABLED';

  const refreshLocalConvList = useCallback(() => {
    setLocalConversations(getLocalConvList());
  }, [getLocalConvList]);

  const syncLocalConversationState = useCallback((targetConvId?: string | null) => {
    const resolvedConvId = targetConvId === undefined ? getCurrentConvId() : targetConvId;
    const conversation = resolvedConvId ? getConversationById(resolvedConvId) : null;

    setCurrentLocalConvId(resolvedConvId);
    setLocalMessages(conversation ? conversation.messages.map(storedToMessage) : []);
  }, [getConversationById, getCurrentConvId]);

  useEffectHook(() => {
    if (
      userRole === 'ADMIN' &&
      location.pathname === '/chat' &&
      (window.location.hash === '#admin' || window.location.hash === '#/admin')
    ) {
      navigate('/admin/users', { replace: true });
    }
  }, [location.pathname, navigate, userRole]);

  useEffectHook(() => {
    refreshLocalConvList();
    syncLocalConversationState();
  }, [refreshLocalConvList, syncLocalConversationState]);

  useEffectHook(() => {
    let cancelled = false;

    const bootstrapFromBackend = async () => {
      try {
        const me = await getCurrentUser();
        if (!cancelled && me.code === 200 && me.data) {
          setCurrentUser(me.data);
        }
      } catch (error) {
        console.warn('[ChatPage] 获取当前用户信息失败，继续使用本地缓存:', error);
      }

      try {
        const response = await getConversationList();
        if (!cancelled && response.code === 200 && response.data) {
          const changed = mergeRemoteConversations(response.data);
          if (changed) {
            refreshLocalConvList();
            syncLocalConversationState();
          }
        }
      } catch (error) {
        console.warn('[ChatPage] 获取后端会话列表失败，继续使用本地缓存:', error);
      }

      try {
        const response = await getResumeList();
        if (!cancelled && response.code === 200 && response.data) {
          const resumes = response.data;
          setUploadedResumes(resumes);
          if (resumes.length > 0) {
            setActiveResumeId(resumes[0].id);
          }
        }
      } catch (error) {
        console.warn('[ChatPage] 获取简历列表失败:', error);
      }
    };

    void bootstrapFromBackend();
    return () => {
      cancelled = true;
    };
  }, [mergeRemoteConversations, refreshLocalConvList, syncLocalConversationState]);

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

  // 加载当前本地对话的消息
  useEffectHook(() => {
    if (!currentLocalConvId) {
      setLocalMessages([]);
      return;
    }

    const conversation = getConversationById(currentLocalConvId);
    if (!conversation) {
      setLocalMessages([]);
      return;
    }

    setLocalMessages(conversation.messages.map(storedToMessage));

    const backendId = conversation.backendId ?? conversation.id;
    if (backendId && !hasLoadedFromBackend) {
      setHasLoadedFromBackend(true);
      loadConversation(Number(backendId)).catch((error) => {
        console.warn('[ChatPage] 从后端加载消息失败，使用本地缓存:', error);
      });
    }
  }, [currentLocalConvId, getConversationById, hasLoadedFromBackend, loadConversation]);

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

    let activeLocalConvId = currentLocalConvId ?? getCurrentConvId();
    const userMessage: Message = { role: 'user', content: message };

    if (useLocalMode) {
      if (activeLocalConvId) {
        addMessage({ role: 'user', content: message }, activeLocalConvId);
        setLocalMessages((prev) => [...prev, userMessage]);
      } else {
        activeLocalConvId = createConversation({
          title: message,
          initialMessage: { role: 'user', content: message },
        });
        optimisticConversationIdRef.current = activeLocalConvId;
        setCurrentLocalConvId(activeLocalConvId);
        setLocalMessages([userMessage]);
      }

      refreshLocalConvList();
    }

    const activeConversation = activeLocalConvId ? getConversationById(activeLocalConvId) : null;
    const effectiveRemoteConversationId =
      remoteConvId ??
      activeConversation?.backendId ??
      activeConversation?.id ??
      undefined;

    sendMessage(
      message,
      effectiveRemoteConversationId ? Number(effectiveRemoteConversationId) : undefined,
      activeResumeId || undefined
    );

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
      const nextConversationId = createConversation();
      optimisticConversationIdRef.current = nextConversationId;
      setCurrentLocalConvId(nextConversationId);
      setLocalMessages([]);
      setHasLoadedFromBackend(false);
      resetChatState();
      refreshLocalConvList();
    } else {
      clearMessages();
    }

    if (isAdminRoute) {
      navigate('/chat');
    }
    setIsMobileSidebarOpen(false);
  };

  // 选择本地对话
  const handleSelectConversation = useCallback((id: number | string) => {
    if (isLoading) return;

    setIsSwitchingConversation(true);
    setHasLoadedFromBackend(false);
    optimisticConversationIdRef.current = null;

    // 清理旧的流状态和 SSE 连接
    resetChatState();

    try {
      const convId = id as string;
      switchConversation(convId);
      setCurrentLocalConvId(convId);

      const conv = getConversationById(convId);

      if (conv) {
        const msgs: Message[] = conv.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          reasoning: msg.reasoning,
        }));
        setLocalMessages(msgs);
      } else {
        setLocalMessages([]);
      }
    } finally {
      setIsSwitchingConversation(false);
    }

    if (isAdminRoute) {
      navigate('/chat');
    }
    setIsMobileSidebarOpen(false);
  }, [
    getConversationById,
    isAdminRoute,
    isLoading,
    navigate,
    resetChatState,
    switchConversation,
  ]);

  // 删除本地对话
  const handleDeleteConversation = async (id: number | string) => {
    if (isLoading) return;

    const convId = id as string;
    const isCurrentConv = getCurrentConvId() === convId;
    const conversation = getConversationById(convId);
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
    if (optimisticConversationIdRef.current === convId) {
      optimisticConversationIdRef.current = null;
    }

    if (isCurrentConv) {
      setLocalMessages([]);
      setCurrentLocalConvId(null);
      setHasLoadedFromBackend(false);
    }

    refreshLocalConvList();
  };

  // 拖拽排序对话
  const handleReorderConversations = useCallback((orderedIds: string[]) => {
    reorderConversations(orderedIds);
    refreshLocalConvList();
  }, [refreshLocalConvList, reorderConversations]);

  // 同步后端 ID
  useEffectHook(() => {
    if (!remoteConvId) {
      return;
    }

    const targetLocalConvId =
      optimisticConversationIdRef.current ??
      currentLocalConvId ??
      getCurrentConvId();

    if (!targetLocalConvId) {
      return;
    }

    const activeConversation = getConversationById(targetLocalConvId);
    const currentBackendId = activeConversation?.backendId ?? activeConversation?.id;

    if (currentBackendId === remoteConvId) {
      optimisticConversationIdRef.current = null;
      return;
    }

    const syncedConversationId = syncBackendId(targetLocalConvId, remoteConvId);
    if (!syncedConversationId) {
      return;
    }

    optimisticConversationIdRef.current = null;
    setCurrentLocalConvId(syncedConversationId);
    refreshLocalConvList();
  }, [
    currentLocalConvId,
    getConversationById,
    getCurrentConvId,
    refreshLocalConvList,
    remoteConvId,
    syncBackendId,
  ]);

  const handleLogout = async () => {
    if (isLoading) {
      await abortStream();
    }

    savedStreamingMessageRef.current.clear();
    optimisticConversationIdRef.current = null;
    clearAll();
    resetChatState();
    setLocalMessages([]);
    setLocalConversations([]);
    setCurrentLocalConvId(null);
    setHasLoadedFromBackend(false);
    setCurrentUser(null);

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
    navigate('/admin/users');
    setIsMobileSidebarOpen(false);
  };

  const handleCloseAdmin = () => {
    navigate('/chat');
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploadError(null);
    setAvatarUploading(true);

    try {
      const response = await uploadAvatarFile(file);
      if (response.code === 200) {
        const me = await getCurrentUser();
        if (me.code === 200 && me.data) {
          setCurrentUser(me.data);
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || '头像上传失败';
      setAvatarUploadError(errorMessage.replace(/^Error: /, ''));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    try {
      const response = await uploadDocument(file, 'resume');
      if (response.code === 200) {
        const listResponse = await getResumeList();
        if (listResponse.code === 200 && listResponse.data) {
          const resumes = listResponse.data;
          setUploadedResumes(resumes);
          if (resumes.length > 0) {
            setActiveResumeId(resumes[0].id);
          }
        }
      }
    } catch (error: any) {
      console.error('[ChatPage] 简历上传失败:', error);
    }
  };

  const hasMessages = displayMessages.length > 0;
  const currentConvId = currentLocalConvId;
  const currentTitle = currentConvId
    ? localConversations.find(c => c.id === currentConvId)?.title
    : null;
  const shellStyle = useMemo<CSSProperties | undefined>(() => {
    return viewportHeight > 0
      ? { height: `${Math.round(viewportHeight)}px` }
      : undefined;
  }, [viewportHeight]);

  const handleOpenProfile = () => {
    setShowProfileModal(true);
  };

  const handleProfileSuccess = async () => {
    const me = await getCurrentUser();
    if (me.code === 200 && me.data) {
      setCurrentUser(me.data);
    }
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
        currentUser={profileUser}
        isAdminRoute={isAdminRoute}
        showAdminEntry={showAdminEntry}
        onOpenAdmin={handleOpenAdmin}
        onLogout={handleLogout}
        onUploadAvatar={handleAvatarUpload}
        onOpenProfile={handleOpenProfile}
        avatarUploading={avatarUploading}
        avatarUploadError={avatarUploadError}
        canCreateConversation={!userDisabled}
        onOpenAgentSettings={() => {
          setTempAgentName(agentName);
          setShowAgentSettings(true);
        }}
        agentName={agentName}
      />

      {/* 用户资料模态框 */}
      <UserProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={profileUser}
        onSuccess={handleProfileSuccess}
      />

      {/* 主聊天区域 */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isAdminRoute ? (
          <AdminPanel onBack={handleCloseAdmin} />
        ) : (
          <>
            {/* 顶部导航栏 */}
            <header className="relative shrink-0 bg-transparent">
              <div
                className="relative flex items-center justify-between gap-2 px-4 pb-2 pt-4"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {/* 移动端菜单按钮 */}
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-soft)] lg:hidden"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  <h1 className="truncate text-lg font-medium text-[var(--text-primary)]">
                    {currentTitle || '新对话'}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenProfile}
                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] transition-transform hover:scale-105 active:scale-95"
                  >
                    {profileUser?.avatarUrl ? (
                      <img src={profileUser.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-[var(--text-secondary)]">
                        {profileUser ? profileUser.username.slice(0, 1).toUpperCase() : '?'}
                      </span>
                    )}
                  </button>
                </div>
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
                <div className="flex h-full flex-col items-center justify-center px-4 pb-20">
                  <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-700">
                    <h2 className="mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
                      你好，{username || '朋友'}
                    </h2>
                    <p className="text-xl font-medium text-[var(--text-secondary)] sm:text-2xl">
                      我是你的 AI 求职助手，今天想聊聊什么？
                    </p>
                    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button 
                        onClick={() => handleSend('帮我优化目前的简历内容')}
                        className="flex flex-col items-start rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 text-left transition-all hover:bg-[var(--surface-soft)] hover:shadow-md"
                      >
                        <span className="text-sm font-medium text-[var(--text-primary)]">简历优化</span>
                        <span className="text-xs text-[var(--text-muted)]">提升经历描述的专业度</span>
                      </button>
                      <button 
                        onClick={() => handleSend('根据我的背景推荐适合的岗位')}
                        className="flex flex-col items-start rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 text-left transition-all hover:bg-[var(--surface-soft)] hover:shadow-md"
                      >
                        <span className="text-sm font-medium text-[var(--text-primary)]">背景分析</span>
                        <span className="text-xs text-[var(--text-muted)]">挖掘你的核心竞争力</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pb-2 pt-1 sm:pb-4">
                  {displayMessages.map((msg, idx) => (
                    <MessageBubble
                      key={getMessageRenderKey(msg, idx)}
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
              activeResume={activeResume ? { id: activeResume.id, name: activeResume.name } : null}
              onFileUpload={handleResumeUpload}
              onRemoveResume={() => setActiveResumeId(null)}
            />
          </>
        )}
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
