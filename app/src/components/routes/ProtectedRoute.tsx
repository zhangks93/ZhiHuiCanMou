import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/constants'
import { AppLoading } from '@/components/ui/AppLoading'

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

  console.log('[Canmou ProtectedRoute] user:', user?.name || 'null', 'loading:', loading, 'path:', location.pathname)

  if (loading) {
    return <AppLoading variant="screen" label="加载中..." />
  }

  if (!user) {
    console.log('[Canmou ProtectedRoute] No user, redirecting to login')
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <>{children}</>
}
