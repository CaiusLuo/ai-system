import { useState, useRef, useEffect, type DragEvent } from 'react';
import type { ConversationDTO, LocalConversationSummary, StoredCurrentUser } from '../types';
import { SidebarBrandMotion } from '../remotion';

interface SidebarProps {
  conversations?: ConversationDTO[];
  activeConversationId?: number | null;
  onSelectConversation?: (id: number | string) => void;
  onDeleteConversation?: (id: number | string) => void;

  localConversations?: LocalConversationSummary[];
  currentLocalConvId?: string | null;
  onSelectLocalConversation?: (id: string) => void;
  onDeleteLocalConversation?: (id: string) => void;
  onReorderConversations?: (orderedIds: string[]) => void;

  onNewConversation: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser?: StoredCurrentUser | null;
  isAdminRoute?: boolean;
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
  currentUser,
  isAdminRoute = false,
  showAdminEntry,
  onOpenAdmin,
  onLogout,
  canCreateConversation = true,
  onOpenAgentSettings,
  agentName = '工作台',
}: SidebarProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const dragOverListRef = useRef<string[]>([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const canDragReorder = isDesktop && typeof onReorderConversations === 'function';
  const username = currentUser?.username || '用户';
  const userRoleLabel = currentUser
    ? currentUser.role === 'ADMIN'
      ? '管理员'
      : '普通用户'
    : '账户';
  const userStatusLabel = currentUser?.statusText || '已登录';
  const userDisabled = currentUser?.status === 0 || currentUser?.statusText === '禁用';

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    if (!canDragReorder) {
      return;
    }

    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    if (!canDragReorder) {
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedId && draggedId !== id) {
      setDragOverId(id);

      const list = [...localConversations.map((c) => c.id)];
      const draggedIndex = list.indexOf(draggedId);
      const targetIndex = list.indexOf(id);

      if (draggedIndex > -1 && targetIndex > -1 && draggedIndex !== targetIndex) {
        list.splice(draggedIndex, 1);
        list.splice(targetIndex, 0, draggedId);
        dragOverListRef.current = list;
      }
    }
  };

  const handleDragLeave = () => {
    if (!canDragReorder) {
      return;
    }

    setDragOverId(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!canDragReorder) {
      return;
    }

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
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex h-full w-[86vw] max-w-[320px] flex-col
          border-r border-[var(--border-subtle)] bg-[var(--surface-raised)] transition-transform duration-300 ease-out
          lg:relative lg:w-72 lg:max-w-none lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0 shadow-[0_18px_40px_rgba(15,23,42,0.14)]' : '-translate-x-full'}
        `}
      >
        <div
          className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 pb-2 pt-2 lg:hidden"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">会话列表</h2>
          <button
            onClick={onCloseMobile}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
            aria-label="关闭会话列表"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-[var(--border-subtle)] px-3 pb-3 pt-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2.5 py-2">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--accent-700)]">
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M4 7.5h16M6.5 4.5h11A1.5 1.5 0 0119 6v12a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18V6a1.5 1.5 0 011.5-1.5z"
                />
              </svg>
              <SidebarBrandMotion className="absolute inset-0" opacity={0.36} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">求职工作台</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">岗位匹配与投递管理</p>
            </div>
          </div>

          <button
            onClick={onNewConversation}
            disabled={!canCreateConversation}
            className={`
              flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors
              ${
                canCreateConversation
                  ? 'bg-[var(--accent-700)] text-white hover:bg-[var(--accent-800)]'
                  : 'cursor-not-allowed bg-gray-200 text-gray-500'
              }
            `}
            title={!canCreateConversation ? '账户已禁用，无法创建新会话' : ''}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 4v16m8-8H4" />
            </svg>
            新建会话
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-y-contain px-2 py-2">
          {localConversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">暂无会话</div>
          ) : (
            <div className="space-y-1.5">
              {localConversations.map((conv) => {
                const isDragged = draggedId === conv.id;
                const isDragOver = dragOverId === conv.id;
                const isActive = !isAdminRoute && currentLocalConvId === conv.id;

                return (
                  <div
                    key={conv.id}
                    draggable={canDragReorder}
                    onDragStart={canDragReorder ? (e) => handleDragStart(e, conv.id) : undefined}
                    onDragOver={canDragReorder ? (e) => handleDragOver(e, conv.id) : undefined}
                    onDragLeave={canDragReorder ? handleDragLeave : undefined}
                    onDrop={canDragReorder ? handleDrop : undefined}
                    onDragEnd={canDragReorder ? handleDragEnd : undefined}
                    className={`
                      group relative rounded-[var(--radius-md)] border transition-all duration-150
                      ${isActive ? 'border-[var(--accent-200)] bg-[var(--accent-050)]' : 'border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-soft)]'}
                      ${isDragged ? 'opacity-40' : 'opacity-100'}
                      ${isDragOver ? 'border-t border-[var(--accent-300)]' : ''}
                      ${canDragReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                    `}
                  >
                    <button
                      onClick={() => onSelectLocalConversation?.(conv.id)}
                      className="w-full min-h-[54px] px-3 py-2.5 pr-10 text-left"
                    >
                      <h3 className="truncate text-sm text-[var(--text-primary)]">{conv.title || '未命名会话'}</h3>
                      {conv.lastMessageContent && (
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          {conv.lastMessageContent.substring(0, 48)}
                          {conv.lastMessageContent.length > 48 ? '...' : ''}
                        </p>
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLocalConversation?.(conv.id);
                      }}
                      className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100"
                      aria-label="删除会话"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="space-y-1 border-t border-[var(--border-subtle)] px-3 pb-2 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          {onOpenAgentSettings && (
            <button
              onClick={onOpenAgentSettings}
              className="flex min-h-[42px] w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-soft)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-500)]" />
              </div>
              <span className="truncate">{agentName}</span>
            </button>
          )}

          {showAdminEntry && (
            <button
              onClick={() => onOpenAdmin?.()}
              className={`
                flex min-h-[42px] w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors
                ${
                  isAdminRoute
                    ? 'bg-[var(--accent-050)] text-[var(--accent-700)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              用户管理
            </button>
          )}

          <div className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--text-secondary)]">{username}</p>
              <p className={`truncate text-[11px] ${userDisabled ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                {userRoleLabel} · {userStatusLabel}
              </p>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
                title="退出登录"
                aria-label="退出登录"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
