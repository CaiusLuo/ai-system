import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthStatus, isAdmin } from '../services/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const authStatus = getAuthStatus();
  
  if (authStatus !== 'valid') {
    const target = authStatus === 'expired' ? '/auth?reason=session-expired' : '/auth';
    return <Navigate to={target} replace />;
  }

  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}
