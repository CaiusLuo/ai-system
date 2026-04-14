import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-[var(--radius-md)] border bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--text-primary)] shadow-none transition-colors placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-200)] ${
          error ? 'border-red-400' : 'border-[var(--border-subtle)]'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
};

export default Input;
