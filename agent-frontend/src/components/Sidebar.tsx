import { useState, useRef, type DragEvent } from 'react';
import type { ConversationDTO } from '../services/conversation';

interface LocalConvItem {
  id: string;
  title: string;
  backendId: number | null;
  updatedAt: number;
  lastMessageContent?: string | null;
  lastMessageTime?: string | null;
}

interface SidebarProps {
  conversations?: ConversationDTO[];
  activeConversationId?: number | null;
  onSelectConversation?: (id: number | string) => void;
  onDeleteConversation?: (id: number | string) => void;

  localConversations?: LocalConvItem[];
  currentLocalConvId?: string | null;
  onSelectLocalConversation?: (id: string) => void;
  onDeleteLocalConversation?: (id: string) => void;
  onReorderConversations?: (orderedIds: string[]) => void;

  onNewConversation: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  username?: string;
  showAdminEntry?: boolean;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  canCreateConversation?: boolean;
  onOpenAgentSettings?: () => void;
  agentName?: string;
}

export default function Sidebar({
  conversations: _conversations = [],
  activeConversationId: _activeConversationId,
  onSelectConversation: _onSelectConversation,
  onDeleteConversation: _onDeleteConversation,
  localConversations = [],
  currentLocalConvId,
  onSelectLocalConversation,
  onDeleteLocalConversation,
  onReorderConversations,
  onNewConversation,
  isMobileOpen,
  onCloseMobile,
  username,
  showAdminEntry,
  onOpenAdmin,
  onLogout,
  canCreateConversation = true,
  onOpenAgentSettings,
  agentName = '助手',
}: SidebarProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragOverListRef = useRef<string[]>([]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
      
      const list = [...(localConversations.map(c => c.id))];
      const draggedIndex = list.indexOf(draggedId);
      const targetIndex = list.indexOf(id);
      
      if (draggedIndex > -1 && targetIndex > -1 && draggedIndex !== targetIndex) {
        list.splice(draggedIndex, 1);
        const insertIndex = draggedIndex > targetIndex ? targetIndex : targetIndex;
        list.splice(insertIndex, 0, draggedId);
        
        dragOverListRef.current = list;
      }
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (draggedId && dragOverListRef.current.length > 0) {
      onReorderConversations?.(dragOverListRef.current);
    }
    
    setDraggedId(null);
    setDragOverId(null);
    dragOverListRef.current = [];
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragOverListRef.current = [];
  };

  return (
    <>
      {/* 移动端遮罩 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`
          fixed lg:relative z-40 lg:z-auto
          h-full w-64 flex flex-col
          bg-white dark:bg-gray-900
          border-r border-gray-100 dark:border-gray-800
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* 新建对话按钮 */}
        <div className="p-3">
          <button
            onClick={onNewConversation}
            disabled={!canCreateConversation}
            className={`
              w-full flex items-center gap-2.5 px-3 py-2.5
              text-sm
              text-gray-700 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-800
              rounded-lg
              transition-colors duration-150
              ${!canCreateConversation ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title={!canCreateConversation ? '账户已禁用，无法创建新对话' : ''}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            新对话
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
          {localConversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              暂无会话
            </div>
          ) : (
            <div className="space-y-0.5">
              {localConversations.map((conv) => {
                const isDragged = draggedId === conv.id;
                const isDragOver = dragOverId === conv.id;
                const isActive = currentLocalConvId === conv.id;

                return (
                  <div
                    key={conv.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, conv.id)}
                    onDragOver={(e) => handleDragOver(e, conv.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={`
                      group relative
                      ${isActive
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }
                      ${isDragged ? 'opacity-40' : 'opacity-100'}
                      ${isDragOver ? 'border-t border-gray-300 dark:border-gray-600' : ''}
                      rounded-lg
                      cursor-pointer
                      transition-all duration-150
                    `}
                  >
                    <button
                      onClick={() => onSelectLocalConversation?.(conv.id)}
                      className="w-full text-left px-3 py-2.5"
                    >
                      <h3 className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {conv.title || '新对话'}
                      </h3>
                      {conv.lastMessageContent && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {conv.lastMessageContent.substring(0, 35)}{conv.lastMessageContent.length > 35 ? '...' : ''}
                        </p>
                      )}
                    </button>

                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('确定要删除此会话吗？')) {
                          onDeleteLocalConversation?.(conv.id);
                        }
                      }}
                      className="absolute top-1.5 right-1.5 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部设置区域 */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
          {/* Agent 设置 */}
          {onOpenAgentSettings && (
            <button
              onClick={onOpenAgentSettings}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-lg"
            >
              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-gray-400" />
              </div>
              <span className="truncate">{agentName}</span>
            </button>
          )}

          {/* 管理员入口 */}
          {showAdminEntry && (
            <button
              onClick={() => onOpenAdmin?.()}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              用户管理
            </button>
          )}

          {/* 用户信息和登出 */}
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {username || '用户'}
            </p>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded"
                title="退出登录"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
