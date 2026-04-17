import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/hooks/useAuth'
import { ROUTES } from '@/app/config/constants'
import { AppLoading } from '@/shared/ui/AppLoading'

type ProtectedRouteProps = {
  children: React.ReactNode
}

/**
 * Protects routes that require authentication.
 * Redirects to login if user is not authenticated.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AppLoading variant="screen" label="加载中..." />
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <>{children}</>
}
