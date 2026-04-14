import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // memo 确保 content 不变时不会重新渲染
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[1.3rem] leading-[1.45] font-semibold tracking-[0.008em] mt-5 mb-2.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[1.14rem] leading-[1.5] font-semibold tracking-[0.007em] mt-4 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[1.02rem] leading-[1.55] font-semibold tracking-[0.006em] mt-3.5 mb-1.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-2.5 leading-[1.82] tracking-[0.012em] last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-inherit">
              {children}
            </strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2.5 space-y-1.5 marker:text-gray-500 dark:marker:text-gray-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2.5 space-y-1.5 marker:text-gray-500 dark:marker:text-gray-400">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-[1.8] tracking-[0.012em]">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-gray-300 dark:border-gray-600 pl-3.5 py-0.5 text-[0.95em] leading-[1.8] text-gray-600 dark:text-gray-300">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[0.84em] font-medium font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className={`${className ?? ''} block text-[13px] leading-6 font-mono`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 px-3.5 py-3 overflow-x-auto">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-[0.9em]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 bg-gray-50 dark:bg-gray-800 font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 align-top">
              {children}
            </td>
          ),
          hr: () => (
            <hr className="my-4 border-gray-200 dark:border-gray-700" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;
