import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/config/constants'

type PublicRouteProps = {
  children: React.ReactNode
}

/**
 * For login page - redirects to home if already authenticated
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">加载中...</div>
      </div>
    )
  }

  if (user) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
