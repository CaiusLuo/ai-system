import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCurrentUser, login, register } from '../services/auth';
import Button from '../components/Button';
import Input from '../components/Input';
import { LoginAmbientMotion, SidebarBrandMotion } from '../remotion';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('reason') === 'session-expired') {
      setError('登录已过期，请重新登录');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await login({ username, password });
        if (response.code === 200) {
          try {
            await getCurrentUser();
          } catch (syncError) {
            console.warn('[AuthPage] 获取当前用户信息失败，进入聊天页后重试:', syncError);
          }

          navigate('/chat');
        } else {
          setError(response.message || '登录失败');
        }
      } else {
        const response = await register({ username, email, password });
        if (response.code === 200) {
          setMode('login');
          setError('');
          setUsername('');
          setEmail('');
          setPassword('');
          setError('注册成功，请登录');
        } else {
          setError(response.message || '注册失败');
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '操作失败，请稍后重试';
      setError(errorMsg.replace(/^Error: /, ''));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-canvas)] px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,rgba(17,24,39,0.06),transparent_58%)]" />
        <LoginAmbientMotion className="absolute inset-0" opacity={0.52} />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <div className="w-full">
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--accent-700)] shadow-[var(--shadow-soft)]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M4 7.5h16M6.5 4.5h11A1.5 1.5 0 0119 6v12a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18V6a1.5 1.5 0 011.5-1.5zm2.5 7h6m-6 3h4"
                />
              </svg>
              <SidebarBrandMotion className="absolute inset-0" opacity={0.36} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">求职工作台</p>
              <p className="text-xs text-[var(--text-muted)]">岗位匹配与投递管理</p>
            </div>
          </div>

          <section className="surface-panel p-6 sm:p-7">
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {mode === 'login' ? '登录账户' : '创建账户'}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                {mode === 'login' ? '继续管理你的求职进度' : '注册后可保存岗位与投递记录'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  className={`rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm ${
                    error.includes('成功')
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {error}
                </div>
              )}

              <Input
                label="用户名"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />

              {mode === 'register' && (
                <Input
                  label="邮箱"
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}

              <Input
                label="密码"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button type="submit" loading={loading} className="mt-1 w-full" size="md">
                {mode === 'login' ? '登录' : '注册'}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm font-medium text-[var(--accent-700)] transition-colors hover:text-[var(--accent-800)]"
              >
                {mode === 'login' ? '还没有账户？立即注册' : '已有账户？立即登录'}
              </button>
            </div>
          </section>

          <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
            继续使用即表示你同意使用条款与隐私说明
          </p>
        </div>
      </div>
    </div>
  );
}
