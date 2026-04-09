import React, { useState, useEffect } from 'react';
import Table from '../components/Table';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Switch from '../components/Switch';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import {
  User,
  getUserList,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  type UserListParams,
  type CreateUserParams,
  type UpdateUserParams,
} from '../services/adminApi';

interface UserFormState {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
}

const initialFormState: UserFormState = {
  username: '',
  email: '',
  password: '',
  role: 'USER',
  status: 'ACTIVE',
};

const AdminUserManagement: React.FC = () => {
  // 列表状态
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  
  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // 弹窗状态
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formState, setFormState] = useState<UserFormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<Partial<UserFormState>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // 删除确认弹窗
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // 消息提示
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 加载用户列表
  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: UserListParams = {
        page,
        pageSize,
        keyword: keyword || undefined,
        role: (filterRole as 'ADMIN' | 'USER') || undefined,
        status: (filterStatus as 'ACTIVE' | 'DISABLED') || undefined,
      };

      const response = await getUserList(params);
      if (response.code === 200) {
        setUsers(response.data.list);
        setTotal(response.data.total);
      }
    } catch (error: any) {
      const errorMsg = error?.message || '加载用户列表失败';
      showMessage('error', errorMsg.replace(/^Error: /, ''));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadUsers();
  }, [page, pageSize, keyword, filterRole, filterStatus]);
  
  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };
  
  // 搜索
  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };
  
  // 重置筛选
  const handleReset = () => {
    setKeyword('');
    setFilterRole('');
    setFilterStatus('');
    setPage(1);
  };
  
  // 打开新增弹窗
  const handleAdd = () => {
    setEditingUser(null);
    setFormState(initialFormState);
    setFormErrors({});
    setModalOpen(true);
  };
  
  // 打开编辑弹窗
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormState({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setFormErrors({});
    setModalOpen(true);
  };
  
  // 验证表单
  const validateForm = (): boolean => {
    const errors: Partial<UserFormState> = {};
    
    if (!formState.username.trim()) {
      errors.username = '用户名不能为空';
    }
    
    if (!formState.email.trim()) {
      errors.email = '邮箱不能为空';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      errors.email = '邮箱格式不正确';
    }
    
    if (!editingUser && !formState.password) {
      errors.password = '密码不能为空';
    } else if (formState.password && formState.password.length < 6) {
      errors.password = '密码长度不能少于6位';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitLoading(true);
    try {
      if (editingUser) {
        // 编辑
        const data: UpdateUserParams = {
          username: formState.username,
          email: formState.email,
          role: formState.role,
          status: formState.status,
        };
        if (formState.password) {
          data.password = formState.password;
        }

        const response = await updateUser(editingUser.id, data);
        if (response.code === 200) {
          showMessage('success', response.message || '用户更新成功');
        }
      } else {
        // 新增
        const data: CreateUserParams = {
          username: formState.username,
          email: formState.email,
          password: formState.password,
          role: formState.role,
          status: formState.status,
        };

        const response = await createUser(data);
        if (response.code === 200) {
          showMessage('success', response.message || '用户创建成功');
        }
      }

      setModalOpen(false);
      loadUsers();
    } catch (error: any) {
      const errorMsg = error?.message || (editingUser ? '更新用户失败' : '创建用户失败');
      showMessage('error', errorMsg.replace(/^Error: /, ''));
    } finally {
      setSubmitLoading(false);
    }
  };
  
  // 删除用户
  const handleDelete = (user: User) => {
    setDeletingUser(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;

    setDeleteLoading(true);
    try {
      const response = await deleteUser(deletingUser.id);
      if (response.code === 200) {
        showMessage('success', response.message || '用户删除成功');
        loadUsers();
      }
    } catch (error: any) {
      const errorMsg = error?.message || '删除用户失败';
      showMessage('error', errorMsg.replace(/^Error: /, ''));
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
      setDeletingUser(null);
    }
  };

  // 切换用户状态
  const handleToggleStatus = async (user: User) => {
    try {
      const response = await toggleUserStatus(user.id);
      if (response.code === 200) {
        const action = response.data.status === 'ACTIVE' ? '启用' : '禁用';
        showMessage('success', response.message || `用户${action}成功`);
        loadUsers();
      }
    } catch (error: any) {
      const errorMsg = error?.message || '操作失败';
      showMessage('error', errorMsg.replace(/^Error: /, ''));
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 'w-20',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {value === 'ADMIN' ? '管理员' : '普通用户'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value === 'ACTIVE' ? '正常' : '禁用'}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'ACTIVE' ? '禁用' : '启用'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];
  
  // 角色选项
  const roleOptions = [
    { value: 'ADMIN', label: '管理员' },
    { value: 'USER', label: '普通用户' },
  ];
  
  const statusOptions = [
    { value: 'ACTIVE', label: '正常' },
    { value: 'DISABLED', label: '禁用' },
  ];
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 消息提示 */}
        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}
        
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理系统用户，包括用户信息、角色和权限</p>
        </div>
        
        {/* 筛选区域 */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="搜索用户名或邮箱"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Select
              options={[{ value: '', label: '全部角色' }, ...roleOptions]}
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            />
            <Select
              options={[{ value: '', label: '全部状态' }, ...statusOptions]}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleSearch} className="flex-1">
                搜索
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                重置
              </Button>
            </div>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="mb-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            共 {total} 个用户
          </div>
          <Button onClick={handleAdd}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增用户
          </Button>
        </div>
        
        {/* 表格 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table
            columns={columns}
            dataSource={users}
            loading={loading}
          />
          
          {/* 分页 */}
          <div className="px-6 py-4 border-t border-gray-200">
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
            />
          </div>
        </div>
      </div>
      
      {/* 新增/编辑弹窗 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? '编辑用户' : '新增用户'}
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} loading={submitLoading}>
              {editingUser ? '保存' : '创建'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="用户名"
            placeholder="请输入用户名"
            value={formState.username}
            onChange={(e) => setFormState({ ...formState, username: e.target.value })}
            error={formErrors.username}
          />
          <Input
            label="邮箱"
            type="email"
            placeholder="请输入邮箱"
            value={formState.email}
            onChange={(e) => setFormState({ ...formState, email: e.target.value })}
            error={formErrors.email}
          />
          <Input
            label="密码"
            type="password"
            placeholder={editingUser ? '留空则不修改密码' : '请输入密码'}
            value={formState.password}
            onChange={(e) => setFormState({ ...formState, password: e.target.value })}
            error={formErrors.password}
          />
          <Select
            label="角色"
            options={roleOptions}
            value={formState.role}
            onChange={(e) => setFormState({ ...formState, role: e.target.value as 'ADMIN' | 'USER' })}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">状态</span>
            <Switch
              checked={formState.status === 'ACTIVE'}
              onChange={(checked) => setFormState({ ...formState, status: checked ? 'ACTIVE' : 'DISABLED' })}
              label={formState.status === 'ACTIVE' ? '正常' : '禁用'}
            />
          </div>
        </div>
      </Modal>
      
      {/* 删除确认弹窗 */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="确认删除"
        width="max-w-sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteLoading}>
              删除
            </Button>
          </>
        }
      >
        <div className="py-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-center text-gray-700">
            确定要删除用户 <span className="font-medium">{deletingUser?.username}</span> 吗？
          </p>
          <p className="text-center text-sm text-gray-500 mt-2">
            此操作不可恢复
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUserManagement;
