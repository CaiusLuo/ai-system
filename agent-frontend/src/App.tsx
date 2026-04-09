import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import AdminUserManagement from './pages/AdminUserManagement'
import AuthPage from './pages/AuthPage'
import ProtectedRoute from './components/ProtectedRoute'
import { isLoggedIn } from './services/auth'

function App() {
  const loggedIn = isLoggedIn();

  return (
    <BrowserRouter>
      <Routes>
        {/* 认证页面 */}
        <Route path="/auth" element={loggedIn ? <Navigate to="/" replace /> : <AuthPage />} />
        
        {/* 主聊天页面（需要认证） */}
        <Route path="/" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />
        
        {/* 管理员用户管理（需要 ADMIN 角色） */}
        <Route path="/admin/users" element={
          <ProtectedRoute requireAdmin>
            <AdminUserManagement />
          </ProtectedRoute>
        } />
        
        {/* 未知路由重定向到首页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
