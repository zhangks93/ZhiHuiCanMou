import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/constants'

type PublicRouteProps = {
  children: React.ReactNode
}

/**
 * For login page - redirects to home if already authenticated
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const { user, loading } = useAuth()

  console.log('[Canmou PublicRoute] user:', user?.name || 'null', 'loading:', loading)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">加载中...</div>
      </div>
    )
  }

  if (user) {
    console.log('[Canmou PublicRoute] User authenticated, redirecting to home')
    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
