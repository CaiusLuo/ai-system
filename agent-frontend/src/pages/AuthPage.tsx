import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/auth';
import Button from '../components/Button';
import Input from '../components/Input';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await login({ username, password });
        if (response.code === 200) {
          navigate('/');
        } else {
          setError(response.message || '登录失败');
        }
      } else {
        const response = await register({ username, email, password });
        if (response.code === 200) {
          // 注册成功后切换到登录模式
          setMode('login');
          setError('');
          setUsername('');
          setEmail('');
          setPassword('');
          // 显示成功提示（使用 error 状态显示成功消息）
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI 助手</h1>
          <p className="mt-2 text-sm text-gray-600">
            {mode === 'login' ? '欢迎回来，请登录您的账户' : '创建新账户开始使用'}
          </p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 错误提示 */}
            {error && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                error.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {error}
              </div>
            )}

            {/* 用户名 */}
            <Input
              label="用户名"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />

            {/* 邮箱（仅注册模式） */}
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

            {/* 密码 */}
            <Input
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {/* 提交按钮 */}
            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              {mode === 'login' ? '登录' : '注册'}
            </Button>
          </form>

          {/* 切换模式 */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {mode === 'login' ? '还没有账户？立即注册' : '已有账户？立即登录'}
            </button>
          </div>
        </div>

        {/* 底部链接 */}
        <p className="mt-6 text-center text-xs text-gray-500">
          继续即表示您同意我们的使用条款
        </p>
      </div>
    </div>
  );
}
