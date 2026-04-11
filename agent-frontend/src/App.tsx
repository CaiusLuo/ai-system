import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { getAuthStatus } from './services/auth'

// 懒加载页面组件（代码分割）
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))

// 加载状态（避免 CLS）
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">加载中...</span>
      </div>
    </div>
  )
}

function App() {
  const authStatus = getAuthStatus();
  const loggedIn = authStatus === 'valid';
  const authRedirect = authStatus === 'expired' ? '/auth?reason=session-expired' : '/auth';

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* 首页：已登录→聊天页面，未登录→落地页 */}
          <Route path="/" element={
            loggedIn ? (
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            ) : authStatus === 'expired' || authStatus === 'invalid' ? (
              <Navigate to={authRedirect} replace />
            ) : (
              <LandingPage />
            )
          } />

          {/* 认证页面 */}
          <Route path="/auth" element={loggedIn ? <Navigate to="/chat" replace /> : <AuthPage />} />

          {/* 聊天页面（需要认证） */}
          <Route path="/chat" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />

          {/* 未知路由重定向到首页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
