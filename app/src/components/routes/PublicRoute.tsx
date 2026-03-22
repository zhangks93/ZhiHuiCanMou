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
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />

        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
          <div className="absolute -right-20 -top-20 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.10),transparent_65%)] animate-pulse-glow" />
          <div className="absolute -bottom-16 -left-16 h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.07),transparent_65%)] animate-pulse-glow [animation-delay:1.2s]" />
        </div>

        <div className="flex flex-col items-center gap-5 animate-fade-in">
          {/* Logo with orbit */}
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-slate-950 text-xs font-semibold tracking-[0.2em] text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)]">
              CM
            </div>
            <div
              className="absolute -inset-3 rounded-[26px] border border-[rgba(37,99,235,0.10)]"
              style={{ animation: 'orbit 16s linear infinite' }}
            />
          </div>

          {/* Spinner */}
          <div className="relative">
            <div className="h-5 w-5 animate-spin rounded-full border-[2px] border-[rgba(148,163,184,0.14)] border-t-[var(--color-accent)]" />
          </div>

          {/* Caption */}
          <p className="text-[12px] tracking-[0.1em] text-[var(--color-text-muted)]/50 animate-breathe">
            LOADING
          </p>
        </div>
      </div>
    )
  }

  if (user) {
    console.log('[Canmou PublicRoute] User authenticated, redirecting to home')
    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
