import { useState, KeyboardEvent, ChangeEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
}

export default function ChatInput({ onSend, isLoading, onStop }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // 自动调整高度
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="max-w-3xl mx-auto">
        {/* 错误提示 */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
              rows={1}
              disabled={isLoading}
              className={`
                w-full resize-none
                px-4 py-3 pr-12
                bg-gray-100 dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-xl
                text-sm
                text-gray-900 dark:text-gray-100
                placeholder-gray-500 dark:placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                scrollbar-thin
              `}
              style={{ minHeight: '48px', maxHeight: '150px' }}
            />
          </div>
          
          {isLoading ? (
            <button
              onClick={onStop}
              className="
                flex-shrink-0
                w-12 h-12
                bg-red-500 hover:bg-red-600
                text-white
                rounded-xl
                flex items-center justify-center
                transition-colors duration-200
                shadow-sm
              "
              title="停止生成"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`
                flex-shrink-0
                w-12 h-12
                rounded-xl
                flex items-center justify-center
                transition-all duration-200
                shadow-sm
                ${
                  input.trim()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>
        
        {/* 底部提示 */}
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          AI 可能产生错误信息，请验证重要内容。
        </p>
      </div>
    </div>
  );
}
