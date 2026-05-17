import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { type StoredCurrentUser } from '../types';
import { updateUserInfo } from '../services/auth';

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: StoredCurrentUser | null;
  onSuccess: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ open, onClose, user, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setPassword('');
      setConfirmPassword('');
      setError(null);
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (password && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await updateUserInfo(user.userId, {
        username: username.trim(),
        email: email.trim(),
        password: password || undefined,
      });

      if (result.code === 200) {
        onSuccess();
        onClose();
      } else {
        setError(result.message || '更新失败');
      }
    } catch (err: any) {
      setError(err.message || '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="修改个人资料"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none disabled:bg-blue-400"
          >
            {loading ? '保存中...' : '保存修改'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700">用户名</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">电子邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">如果不修改密码，请留空</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">新密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default UserProfileModal;
