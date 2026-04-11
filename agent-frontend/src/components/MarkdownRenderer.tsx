import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // memo 确保 content 不变时不会重新渲染
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // 代码块
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !props.node?.properties?.className;
          
          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <code
              className={`${className} block p-3 bg-gray-800 dark:bg-gray-900 rounded-lg text-xs font-mono overflow-x-auto`}
              {...props}
            >
              {children}
            </code>
          );
        },
        // 预格式化块
        pre: ({ children }) => (
          <pre className="my-2 rounded-lg overflow-hidden">
            {children}
          </pre>
        ),
        // 段落
        p: ({ children }) => (
          <p className="my-1.5 last:mb-0">
            {children}
          </p>
        ),
        // 列表
        ul: ({ children }) => (
          <ul className="list-disc list-outside ml-4 my-1.5 space-y-0.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside ml-4 my-1.5 space-y-0.5">
            {children}
          </ol>
        ),
        // 链接
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {children}
          </a>
        ),
        // 表格
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600 text-xs">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1 bg-gray-100 dark:bg-gray-700 font-semibold text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border-t border-gray-200 dark:border-gray-600">
            {children}
          </td>
        ),
        // 引用
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 my-1.5">
            {children}
          </blockquote>
        ),
        // 标题
        h1: ({ children }) => (
          <h1 className="text-lg font-bold my-2">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold my-1.5">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold my-1">
            {children}
          </h3>
        ),
        hr: () => (
          <hr className="my-2 border-gray-300 dark:border-gray-600" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

export default MarkdownRenderer;
