import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'user'
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps = {}) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
