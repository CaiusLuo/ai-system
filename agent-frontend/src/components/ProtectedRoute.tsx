import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isLoggedIn, isAdmin } from '../services/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const loggedIn = isLoggedIn();
  
  if (!loggedIn) {
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
