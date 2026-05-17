import { useState, type KeyboardEvent, type ChangeEvent, useEffect, useRef } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  activeResume?: { id: number; name: string } | null;
  onRemoveResume?: () => void;
}

export default function ChatInput({
  onSend,
  isLoading,
  onStop,
  disabled,
  placeholder = '输入你的问题...',
  autoFocus = false,
  activeResume = null,
  onRemoveResume,
  onFileUpload,
}: ChatInputProps & { onFileUpload?: (file: File) => void }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    if (e.target) e.target.value = '';
  };

  const isDisabled = disabled || isLoading;

  return (
    <div className="shrink-0 px-3 pb-4 pt-2 sm:px-4 sm:pb-6 md:px-6">
      <div className="mx-auto w-full max-w-4xl">
        {/* 活跃简历状态展示 */}
        {activeResume && (
          <div className="mb-2 flex animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] py-1.5 pl-3 pr-2 text-xs font-medium text-[var(--text-secondary)] shadow-sm">
              <svg className="h-3.5 w-3.5 text-[var(--accent-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="max-w-[120px] truncate">{activeResume.name}</span>
              <button
                onClick={onRemoveResume}
                className="ml-1 rounded-full p-0.5 transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                title="移除简历关联"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="group relative flex items-end gap-2 rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 transition-all duration-300 focus-within:border-[var(--accent-400)] focus-within:shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 上传按钮 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            title="上传简历或文档"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isDisabled}
            enterKeyHint="send"
            className="scrollbar-thin min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]"
            style={{ maxHeight: '180px' }}
          />

          <div className="flex-shrink-0 pb-0.5">
            {isLoading ? (
              <button
                onClick={onStop}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--border-subtle)]"
                title="停止生成"
              >
                <div className="h-3.5 w-3.5 rounded-sm bg-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || isDisabled}
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200
                  ${
                    input.trim() && !isDisabled
                      ? 'bg-[var(--accent-700)] text-white shadow-sm hover:bg-[var(--accent-800)] hover:scale-105'
                      : 'cursor-not-allowed text-[var(--text-muted)]'
                  }
                `}
                aria-label="发送消息"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {disabled && (
          <p className="mt-2 text-center text-xs text-red-500">账户已禁用，无法发送消息</p>
        )}
      </div>
    </div>
  );
}
