import { memo, useState, useEffect } from 'react';
import { Message } from '../hooks/useSSEChat';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  agentName?: string;
}

/** AI 机器人 SVG 头像 */
function AgentAvatar() {
  return (
    <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="16" fill="#E5E7EB" />
      <g transform="translate(4, 4)">
        <rect x="3" y="6" width="18" height="14" rx="4" fill="#6B7280" />
        <circle cx="9" cy="13" r="1.5" fill="white" />
        <circle cx="15" cy="13" r="1.5" fill="white" />
        <path d="M9 16.5 Q12 18.5 15 16.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="10" y="1" width="4" height="5" rx="2" fill="#6B7280" />
        <circle cx="12" cy="1" r="1.2" fill="#9CA3AF" />
      </g>
    </svg>
  );
}

/** 用户 SVG 头像 */
function UserAvatar() {
  return (
    <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="16" fill="#3B82F6" />
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
    // 防御：过滤掉 undefined/null/字符串 "undefined"，防止 JavaScript 类型转换导致的异常渲染
    if (message.content && message.content !== 'undefined' && message.content !== 'null') {
      setDisplayContent(message.content);
    } else {
      setDisplayContent('');
    }
  }, [message.content]);

  // 用户消息：右对齐，头像在右侧
  // AI 消息：左对齐，头像在左侧
  return (
    <div
      className={`
        group
        w-full
        py-6
        ${isUser ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-gray-800/30'}
        animate-[fadeIn_0.3s_ease-out]
      `}
    >
      <div className="max-w-3xl mx-auto px-4">
        {isUser ? (
          /* ====== 用户消息（右对齐） ====== */
          <div className="flex justify-end gap-3">
            <div className="max-w-[80%] min-w-0">
              {/* 用户消息正文 */}
              <div className="
                text-[15px] leading-relaxed break-words whitespace-pre-wrap
                text-gray-900 dark:text-gray-100
              ">
                {message.content}
              </div>
            </div>
            <UserAvatar />
          </div>
        ) : (
          /* ====== AI 消息（左对齐） ====== */
          <div className="flex gap-3">
            <AgentAvatar />
            <div className="flex-1 min-w-0">
              {/* 思考过程（可折叠） */}
              {hasReasoning && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowReasoning(!showReasoning)}
                    className="
                      flex items-center gap-2
                      text-xs text-gray-400 dark:text-gray-500
                      hover:text-gray-600 dark:hover:text-gray-400
                      transition-colors duration-150
                    "
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>{showReasoning ? '收起' : '思考过程'}</span>
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${showReasoning ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showReasoning && (
                    <div className="
                      mt-2 pl-3 py-2
                      border-l-2 border-gray-200 dark:border-gray-700
                      text-xs text-gray-500 dark:text-gray-400
                      leading-relaxed whitespace-pre-wrap break-words
                    ">
                      {message.reasoning}
                    </div>
                  )}
                </div>
              )}

              {/* AI 消息正文 */}
              {displayContent ? (
                <MarkdownRenderer content={displayContent} />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
