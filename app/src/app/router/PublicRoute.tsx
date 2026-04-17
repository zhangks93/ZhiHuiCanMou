import { Navigate } from 'react-router-dom'
import { useAuth } from '@/app/hooks/useAuth'
import { ROUTES } from '@/app/config/constants'
import { AppLoading } from '@/shared/ui/AppLoading'

type PublicRouteProps = {
  children: React.ReactNode
}

/**
 * For login page - redirects to home if already authenticated
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return <AppLoading variant="screen" label="加载中..." />
  }

  if (user) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
