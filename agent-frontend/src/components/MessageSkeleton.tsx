interface SkeletonMessageProps {
  count?: number;
}

/**
 * 消息骨架屏 - 模拟对话加载状态
 */
export default function MessageSkeleton({ count = 3 }: SkeletonMessageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex w-full animate-[fadeIn_0.3s_ease-out] ${
            i % 2 === 0 ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`
              max-w-[75%] lg:max-w-[65%]
              rounded-2xl px-4 py-3
              ${i % 2 === 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}
            `}
          >
            {/* 头像骨架 */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full skeleton" />
              <div className="w-16 h-3 rounded skeleton" />
            </div>
            
            {/* 内容骨架 */}
            <div className="space-y-2">
              <div className="w-full h-4 rounded skeleton" />
              <div className="w-4/5 h-4 rounded skeleton" />
              {i % 3 === 0 && (
                <div className="w-3/5 h-4 rounded skeleton" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
