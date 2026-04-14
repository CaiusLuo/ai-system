import { useState, type KeyboardEvent, type ChangeEvent, useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (autoFocus && textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const resetTextareaHeight = () => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = 'auto';
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) {
      return;
    }

    onSend(trimmed);
    setInput('');
    resetTextareaHeight();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  };

  const isDisabled = disabled || isLoading;

  return (
    <div
      className="shrink-0 border-t border-[var(--border-subtle)] bg-[rgba(247,247,245,0.92)] px-3 pt-3 backdrop-blur-sm sm:px-4 sm:pt-3.5"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="mx-auto w-full max-w-4xl">
        {disabled && (
          <div className="mb-2 text-center text-xs text-[var(--text-muted)]">
            账户已禁用，无法发送消息
          </div>
        )}

        <div className="relative flex items-end gap-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-1.5 transition-colors duration-200 focus-within:border-[var(--accent-300)] focus-within:ring-1 focus-within:ring-[var(--accent-200)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isDisabled}
            enterKeyHint="send"
            className="scrollbar-thin min-h-[48px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[16px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]"
            style={{ maxHeight: '180px' }}
          />

          <div className="flex-shrink-0 pb-0.5 pr-0.5">
            {isLoading ? (
              <button
                onClick={onStop}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-700)] text-white transition-colors duration-150 hover:bg-[var(--accent-800)]"
                title="停止生成"
                aria-label="停止生成"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || isDisabled}
                className={`
                  flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-colors duration-150
                  ${
                    input.trim() && !isDisabled
                      ? 'bg-[var(--accent-700)] text-white hover:bg-[var(--accent-800)]'
                      : 'cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-muted)]'
                  }
                `}
                aria-label="发送消息"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {!isLoading && (
          <p className="mt-2 hidden text-center text-xs text-[var(--text-muted)] sm:block">
            按 Enter 发送，Shift + Enter 换行
          </p>
        )}
      </div>
    </div>
  );
}
