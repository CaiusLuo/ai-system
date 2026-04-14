interface SkeletonMessageProps {
  count?: number;
}

export default function MessageSkeleton({ count = 3 }: SkeletonMessageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex w-full animate-[fadeIn_0.3s_ease-out] ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`
              max-w-[75%] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] px-4 py-3 lg:max-w-[65%]
              ${i % 2 === 0 ? 'bg-[var(--accent-050)]' : 'bg-[var(--surface-raised)]'}
            `}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="skeleton h-6 w-6 rounded-full" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>

            <div className="space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-4/5 rounded" />
              {i % 3 === 0 && <div className="skeleton h-4 w-3/5 rounded" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
