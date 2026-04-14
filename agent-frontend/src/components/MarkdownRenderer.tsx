import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body max-w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-2.5 text-[1.18rem] font-semibold leading-[1.45] tracking-[0.008em] sm:text-[1.3rem]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 text-[1.06rem] font-semibold leading-[1.5] tracking-[0.007em] sm:text-[1.14rem]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3.5 mb-1.5 text-[0.98rem] font-semibold leading-[1.55] tracking-[0.006em] sm:text-[1.02rem]">{children}</h3>
          ),
          p: ({ children }) => <p className="my-2.5 leading-[1.82] tracking-[0.012em] last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
          ul: ({ children }) => (
            <ul className="my-2.5 list-disc space-y-1.5 pl-5 marker:text-[var(--text-muted)]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal space-y-1.5 pl-5 marker:text-[var(--text-muted)]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-[1.8] tracking-[0.012em]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[var(--border-subtle)] py-0.5 pl-3.5 text-[0.95em] leading-[1.8] text-[var(--text-secondary)]">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="break-all rounded bg-[var(--surface-soft)] px-1.5 py-0.5 font-mono text-[0.84em] font-medium" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <code className={`${className ?? ''} block text-[13px] leading-6 font-mono`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 max-w-full overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2.5 sm:px-3.5 sm:py-3">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-[var(--accent-700)] underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 max-w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border-subtle)] text-[0.9em]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="bg-[var(--surface-soft)] px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-t border-[var(--border-subtle)] px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-4 border-[var(--border-subtle)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;
