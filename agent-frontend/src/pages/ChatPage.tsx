import { useRef, useState, useEffect as useEffectHook } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSSEChat, Message } from '../hooks/useSSEChat';
import Sidebar from '../components/Sidebar';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import { logout, getUserInfo } from '../services/auth';
import { getConversationList, deleteConversation, Conversation } from '../services/conversation';

export default function ChatPage() {
  const {
    messages,
    currentStreamingMessage,
    isLoading,
    error,
    conversationId,
    sendMessage,
    abortStream,
    clearMessages,
    loadConversation,
  } = useSSEChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState('');
  const navigate = useNavigate();

  // 加载用户信息
  useEffectHook(() => {
    const userInfo = getUserInfo();
    if (userInfo) {
      setUsername(userInfo.username);
      setUserRole(userInfo.role);
    }
  }, []);

  // 加载会话列表
  const loadConversations = async () => {
    try {
      const response = await getConversationList();
      if (response.code === 200 && response.data) {
        setConversations(response.data);
      }
    } catch (error) {
      console.error('[Chat] Failed to load conversations:', error);
    }
  };

  useEffectHook(() => {
    loadConversations();
  }, []);

  // 自动滚动到底部
  useEffectHook(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingMessage]);

  const handleSend = (message: string) => {
    // 使用 hook 中的 conversationId，实现会话连续性
    sendMessage(message, conversationId || undefined);
  };

  const handleNewConversation = () => {
    clearMessages();
    setIsMobileSidebarOpen(false);
  };

  const handleSelectConversation = async (id: number) => {
    await loadConversation(id);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      await deleteConversation(id);
      // 如果删除的是当前会话，清空消息
      if (conversationId === id) {
        clearMessages();
      }
      // 重新加载列表
      loadConversations();
    } catch (error) {
      console.error('[Chat] Failed to delete conversation:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const showAdminEntry = userRole === 'ADMIN';

  // 构建完整的消息列表（包含正在流式输出的消息）
  const displayMessages: Message[] = [
    ...messages,
    ...(currentStreamingMessage
      ? [{ role: 'assistant' as const, content: currentStreamingMessage }]
      : []),
  ];

  // 监听消息变化，刷新会话列表
  useEffectHook(() => {
    if (messages.length > 0 || currentStreamingMessage) {
      loadConversations();
    }
  }, [messages.length, currentStreamingMessage]);

  return (
    <div className="h-full flex bg-white dark:bg-gray-900">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onNewConversation={handleNewConversation}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        username={username}
        showAdminEntry={showAdminEntry}
        onLogout={handleLogout}
      />

      {/* 主聊天区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶部导航栏 */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {conversationId ? `对话 #${conversationId}` : '新对话'}
            </h1>
            {isLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                AI 正在思考...
              </p>
            )}
          </div>

          {/* 清空对话按钮 */}
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
              title="清空对话"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </header>

        {/* 消息列表区域 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-white dark:bg-gray-900">
          {displayMessages.length === 0 ? (
            // 空状态
            <div className="h-full flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  有什么可以帮你的吗？
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  我可以帮你写代码、回答问题、提供建议，或者进行各种创意写作。
                </p>
                
                {/* 快捷提示 */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                  {[
                    '解释 React Hooks',
                    '帮我写一段 Python 代码',
                    '如何提高代码质量？',
                    'TailwindCSS 使用技巧',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSend(prompt)}
                      className="
                        px-3 py-2 text-left
                        bg-gray-50 dark:bg-gray-800
                        border border-gray-200 dark:border-gray-700
                        rounded-xl
                        text-sm text-gray-700 dark:text-gray-300
                        hover:bg-gray-100 dark:hover:bg-gray-700
                        transition-colors duration-150
                      "
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // 消息列表
            <div className="max-w-3xl mx-auto px-4 py-6">
              {displayMessages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  isStreaming={idx === displayMessages.length - 1 && isLoading}
                />
              ))}
              
              {/* 加载指示器 */}
              {isLoading && currentStreamingMessage === '' && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[typing_1s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[typing_1s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[typing_1s_ease-in-out_infinite]" style={{ animationDelay: '400ms' }} />
                  </div>
                  <span>正在生成回复...</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          onStop={abortStream}
        />
      </main>
    </div>
  );
}
