import { memo } from 'react';
import { Message } from '../hooks/useSSEChat';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

const MessageBubble = memo(function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`
        flex w-full mb-4
        ${isUser ? 'justify-end' : 'justify-start'}
        animate-[fadeIn_0.2s_ease-out]
      `}
    >
      <div
        className={`
          max-w-[75%] lg:max-w-[65%]
          rounded-2xl px-4 py-3
          ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }
          shadow-sm
        `}
      >
        {/* 头像标识 */}
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className={`
              w-6 h-6 rounded-full flex items-center justify-center
              ${isUser ? 'bg-blue-700' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            {isUser ? (
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
          <span className={`text-xs font-medium ${isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
            {isUser ? '你' : 'AI 助手'}
          </span>
        </div>

        {/* 消息内容 */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 dark:bg-gray-500 animate-typing align-middle" />
          )}
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
