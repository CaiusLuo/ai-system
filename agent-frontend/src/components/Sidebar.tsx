import { Conversation } from '../services/conversation';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onDeleteConversation: (id: number) => void;
  onNewConversation: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  username?: string;
  showAdminEntry?: boolean;
  onLogout?: () => void;
}

export default function Sidebar({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  isMobileOpen,
  onCloseMobile,
  username,
  showAdminEntry,
  onLogout,
}: SidebarProps) {
  return (
    <>
      {/* 移动端遮罩 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      
      <aside
        className={`
          fixed lg:relative z-40 lg:z-auto
          h-full w-72 flex flex-col
          bg-gray-50 dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* 新建对话按钮 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onNewConversation}
            className="
              w-full flex items-center justify-center gap-2 px-4 py-3
              bg-white dark:bg-gray-700
              border border-gray-300 dark:border-gray-600
              rounded-xl
              text-sm font-medium
              text-gray-700 dark:text-gray-200
              hover:bg-gray-50 dark:hover:bg-gray-600
              transition-colors duration-200
              shadow-sm
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新对话
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              暂无会话
            </div>
          ) : (
            <div className="p-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`
                    group relative
                    ${activeConversationId === conv.id
                      ? 'bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent'
                    }
                    rounded-xl mb-1
                  `}
                >
                  <button
                    onClick={() => onSelectConversation(conv.id)}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {conv.title || '新对话'}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(conv.updatedAt).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </button>
                  
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('确定要删除此会话吗？')) {
                        onDeleteConversation(conv.id);
                      }
                    }}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部设置区域 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {/* 管理员入口 */}
          {showAdminEntry && (
            <button
              onClick={() => window.open('/admin/users', '_blank')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              用户管理
            </button>
          )}

          {/* 用户信息和登出 */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {username || '用户'}
              </p>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
                title="退出登录"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
