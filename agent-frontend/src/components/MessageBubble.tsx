import { memo, useState } from 'react';
import { Message } from '../hooks/useSSEChat';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

const MessageBubble = memo(function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(false);

  const hasReasoning = !!message.reasoning;

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

        {/* 思考过程（可折叠） */}
        {hasReasoning && !isUser && (
          <div className="mb-3 border-b border-gray-200 dark:border-gray-700 pb-3">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="
                w-full flex items-center justify-between
                text-xs text-gray-500 dark:text-gray-400
                hover:text-gray-700 dark:hover:text-gray-300
                transition-colors duration-150
              "
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>{showReasoning ? '收起思考过程' : '查看思考过程'}</span>
              </div>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${showReasoning ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showReasoning && (
              <div className="
                mt-2 px-3 py-2
                bg-yellow-50 dark:bg-yellow-900/20
                border border-yellow-200 dark:border-yellow-800
                rounded-lg
                text-xs text-yellow-800 dark:text-yellow-300
                leading-relaxed whitespace-pre-wrap break-words
              ">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

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
