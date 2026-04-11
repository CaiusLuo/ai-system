import { useState, KeyboardEvent, ChangeEvent, useEffect, useRef } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function ChatInput({ 
  onSend, 
  isLoading, 
  onStop, 
  disabled, 
  placeholder = '输入你的问题...',
  autoFocus = false,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦
  useEffect(() => {
    if (autoFocus && textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;

    onSend(trimmed);
    setInput('');
    
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // 自适应高度
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  const isDisabled = disabled || isLoading;

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4">
      <div className="max-w-3xl mx-auto">
        {/* 禁用提示 */}
        {disabled && (
          <div className="mb-3 text-xs text-gray-400 dark:text-gray-500 text-center">
            账户已禁用，无法发送消息
          </div>
        )}

        {/* 输入框容器 */}
        <div className="
          relative
          flex items-end gap-2
          bg-gray-50 dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-2xl
          focus-within:border-gray-300 dark:focus-within:border-gray-600
          focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-gray-600
          transition-all duration-200
        ">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isDisabled}
            className="
              flex-1
              resize-none
              bg-transparent
              px-4 py-3.5
              text-[15px] leading-relaxed
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              scrollbar-thin
            "
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />

          {/* 发送/停止按钮 */}
          <div className="flex-shrink-0 pb-2 pr-2">
            {isLoading ? (
              <button
                onClick={onStop}
                className="
                  w-9 h-9
                  flex items-center justify-center
                  bg-gray-900 dark:bg-gray-100
                  hover:bg-gray-800 dark:hover:bg-gray-200
                  text-white dark:text-gray-900
                  rounded-xl
                  transition-colors duration-150
                "
                title="停止生成"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || isDisabled}
                className={`
                  w-9 h-9
                  flex items-center justify-center
                  rounded-xl
                  transition-all duration-150
                  ${
                    input.trim() && !isDisabled
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 底部提示 */}
        {!isLoading && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
            按 Enter 发送，Shift + Enter 换行
          </p>
        )}
      </div>
    </div>
  );
}
