import { memo, useState, useEffect } from 'react';
import { Message } from '../hooks/useSSEChat';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  agentName?: string;
}

const MessageBubble = memo(function MessageBubble({ message, isStreaming: _isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(false);
  const [displayContent, setDisplayContent] = useState('');

  const hasReasoning = !!message.reasoning;

  useEffect(() => {
    setDisplayContent(message.content);
  }, [message.content]);

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
        {/* 消息内容区 */}
        <div className="flex gap-4">
          {/* AI 标识（极简） */}
          {!isUser && (
            <div className="flex-shrink-0 w-6 h-6 mt-1.5">
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400" />
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* 思考过程（可折叠，弱化处理） */}
            {hasReasoning && !isUser && (
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

            {/* 消息正文 */}
            <div className={`
              text-[15px] leading-relaxed break-words
              ${isUser 
                ? 'text-gray-900 dark:text-gray-100 whitespace-pre-wrap' 
                : 'text-gray-800 dark:text-gray-200'
              }
            `}>
              {isUser ? (
                message.content
              ) : (
                <MarkdownRenderer content={displayContent} />
              )}
            </div>

            {/* 用户消息标识（极简） */}
            {isUser && (
              <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                你
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
