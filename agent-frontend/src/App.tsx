import { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { getAuthStatus, getLoginRoute, AUTH_PAGE_PATH } from './services/auth'

// 懒加载页面组件（代码分割）
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))

// 加载状态（避免 CLS）
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-canvas)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--accent-500)] border-t-transparent" />
        <span className="text-sm text-[var(--text-muted)]">加载中...</span>
      </div>
    </div>
  )
}

// 路由变化时触发重新检查认证状态的 Hook
function useAuthSync() {
  const [, setAuthTick] = useState(0);
  const location = useLocation();

  // 每次路由变化时重新检查认证状态
  useEffect(() => {
    setAuthTick(t => t + 1);
  }, [location.pathname]);

  const authStatus = getAuthStatus();
  const loggedIn = authStatus === 'valid';

  return { authStatus, loggedIn };
}

function AppRoutes() {
  const { authStatus, loggedIn } = useAuthSync();
  const authRedirect = getLoginRoute(authStatus === 'expired' ? 'session-expired' : 'unauthorized');
  const legacyAuthRedirect = loggedIn ? '/chat' : authRedirect;

  return (
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
      <Route path={AUTH_PAGE_PATH} element={loggedIn ? <Navigate to="/chat" replace /> : <AuthPage />} />

      {/* 兼容旧前端路由，避免 SPA 内旧链接失效 */}
      <Route path="/auth" element={<Navigate to={legacyAuthRedirect} replace />} />

      {/* 聊天页面（需要认证） */}
      <Route path="/chat" element={
        <ProtectedRoute>
          <ChatPage />
        </ProtectedRoute>
      } />

      {/* 未知路由重定向到首页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  );
}

export default App
