import { useCallback } from 'react';
import AdminUserManagement from './AdminUserManagement';

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={handleBack}
          className="group rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          title="返回聊天"
        >
          <svg className="h-5 w-5 text-gray-600 transition-colors group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">用户管理</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">管理系统用户和权限</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <AdminUserManagement />
      </div>
    </div>
  );
}
