import { useState, useEffect, useCallback } from 'react';
import { getUserInfo } from '../services/auth';
import AdminUserManagement from './AdminUserManagement';

interface AdminPanelProps {
  onBack: () => void;
}

/**
 * 管理面板容器 - 使用 URL hash 实现持久化导航
 * 刷新页面时通过 hash 保持状态
 */
export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const userInfo = getUserInfo();
    const isUserAdmin = userInfo?.role === 'ADMIN';
    setIsAdmin(isUserAdmin);

    if (isUserAdmin) {
      // 使用 replaceState 避免多余的历史记录
      history.replaceState({ adminPanel: true }, '', '#admin');
    }

    // 监听 hash 变化
    const handleHashChange = () => {
      if (window.location.hash !== '#admin') {
        onBack();
      }
    };
    window.addEventListener('hashchange', handleHashChange);

    // 监听 popstate（浏览器后退/前进）
    const handlePopState = () => {
      if (window.location.hash !== '#admin') {
        onBack();
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack]);

  const handleBack = useCallback(() => {
    // 清除 hash
    history.replaceState({}, '', window.location.pathname);
    onBack();
  }, [onBack]);

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-red-500 font-medium">无权访问管理面板</p>
          <p className="text-sm text-gray-400 mt-1">需要管理员权限</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 animate-[slideInRight_0.25s_ease-out]">
      {/* 顶部导航栏 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors group"
          title="返回聊天"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            用户管理
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">管理系统用户和权限</p>
        </div>
      </header>

      {/* 管理内容 */}
      <div className="flex-1 overflow-y-auto">
        <AdminUserManagement />
      </div>
    </div>
  );
}
