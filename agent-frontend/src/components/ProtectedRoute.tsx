import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthStatus, isAdmin, getLoginRoute } from '../services/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const authStatus = getAuthStatus();
  
  if (authStatus !== 'valid') {
    const target = getLoginRoute(authStatus === 'expired' ? 'session-expired' : 'unauthorized');
    return <Navigate to={target} replace />;
  }

  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}
