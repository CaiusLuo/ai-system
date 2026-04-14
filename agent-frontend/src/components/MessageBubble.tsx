import { memo, useState, useEffect } from 'react';
import type { Message } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  agentName?: string;
}

function WorkspaceAvatar() {
  return (
    <svg className="h-6 w-6 flex-shrink-0 sm:h-7 sm:w-7" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="16" fill="#ECF2F3" />
      <path d="M9 11h14v10H9z" stroke="#245F66" strokeWidth="1.4" rx="2" />
      <path d="M12 8.8h8" stroke="#245F66" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 15h8M12 18h5" stroke="#245F66" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function UserAvatar() {
  return (
    <svg className="h-6 w-6 flex-shrink-0 sm:h-7 sm:w-7" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="16" fill="#2F6A71" />
      <g transform="translate(6, 4)">
        <circle cx="10" cy="6" r="4.5" fill="white" />
        <path d="M2 22 Q2 15 10 15 Q18 15 18 22" fill="white" />
      </g>
    </svg>
  );
}

const MessageBubble = memo(function MessageBubble({ message, isStreaming: _isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(false);
  const [displayContent, setDisplayContent] = useState('');

  const hasReasoning = !!message.reasoning;

  useEffect(() => {
    if (message.content && message.content !== 'undefined' && message.content !== 'null') {
      setDisplayContent(message.content);
    } else {
      setDisplayContent('');
    }
  }, [message.content]);

  return (
    <div
      className={`
        group w-full py-4 sm:py-5
        ${isUser ? 'bg-transparent' : 'border-y border-[var(--border-subtle)]/60 bg-[var(--surface-soft)]/70'}
        animate-[fadeIn_0.3s_ease-out]
      `}
    >
      <div className="mx-auto max-w-4xl px-3 sm:px-4">
        {isUser ? (
          <div className="flex justify-end gap-2.5 sm:gap-3">
            <div className="min-w-0 max-w-[92%] sm:max-w-[85%] lg:max-w-[78%]">
              <div className="rounded-[var(--radius-lg)] bg-[var(--accent-050)] px-3.5 py-2.5 text-[15px] leading-[1.7] text-[var(--text-primary)] [overflow-wrap:anywhere] whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>
            <UserAvatar />
          </div>
        ) : (
          <div className="flex gap-2.5 sm:gap-3">
            <WorkspaceAvatar />
            <div className="min-w-0 flex-1">
              {hasReasoning && (
                <div className="mb-3 sm:mb-4">
                  <button
                    onClick={() => setShowReasoning(!showReasoning)}
                    className="inline-flex min-h-8 items-center gap-2 rounded-md text-xs text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-secondary)]"
                    aria-expanded={showReasoning}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>{showReasoning ? '收起过程' : '查看过程'}</span>
                    <svg
                      className={`h-3 w-3 transition-transform duration-200 ${showReasoning ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showReasoning && (
                    <div className="mt-2 border-l-2 border-[var(--border-subtle)] py-2 pl-3 text-xs leading-relaxed text-[var(--text-muted)] [overflow-wrap:anywhere] whitespace-pre-wrap break-words">
                      {message.reasoning}
                    </div>
                  )}
                </div>
              )}

              {displayContent ? (
                <div className="max-w-full lg:max-w-[46rem]">
                  <MarkdownRenderer content={displayContent} />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
