import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

export interface UploadedResume {
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

interface ResumeUploadProps {
  onUpload: (file: File) => void | Promise<void>;
  resumes?: UploadedResume[];
  uploading?: boolean;
  error?: string | null;
}

export default function ResumeUpload({ onUpload, resumes = [], uploading = false, error }: ResumeUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    void onUpload(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleFileSelect(file);
    event.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return;
    }
    handleFileSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* 上传区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors
          ${dragOver
            ? 'border-[var(--accent-400)] bg-[var(--accent-050)]'
            : uploading
              ? 'border-[var(--border-subtle)] bg-[var(--surface-soft)]'
              : 'border-[var(--border-subtle)] hover:border-[var(--accent-300)] hover:bg-[var(--surface-soft)]'
          }
        `}
      >
        {uploading ? (
          <>
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-500)] border-t-transparent" />
            <p className="text-sm text-[var(--text-secondary)]">简历上传中...</p>
          </>
        ) : (
          <>
            <svg className="mb-2 h-8 w-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              点击或拖拽上传简历
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              仅支持 PDF 格式，最大 20MB
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* 已上传简历列表 */}
      {resumes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-[var(--text-muted)]">已上传简历</h3>
          {resumes.map((resume, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--text-primary)]">{resume.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {formatFileSize(resume.size)} · {resume.uploadedAt}
                  </p>
                </div>
              </div>
              <a
                href={resume.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-medium text-[var(--accent-700)] transition-colors hover:text-[var(--accent-800)]"
              >
                查看
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
