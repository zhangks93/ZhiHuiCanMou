import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from './AuthContext'
import type { AuthUser } from './AuthContext'
import { AppLoading } from '@/shared/ui/AppLoading'
import {
  clearRefreshTimer,
  mapAuthUser,
  recoverAuthSession,
  scheduleTokenRefresh,
  signOutAuthSession,
  subscribeToAuthState,
} from '@/features/auth/services/authSessionService'
import { registerOAuthCompleteListener, isTauriRuntime } from '@/features/auth/services/tauriOAuthService'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authInProgress, setAuthInProgress] = useState(false)
  const refreshTimerRef = useRef<number | null>(null)
  const refreshInProgressRef = useRef<boolean>(false)

  const applySession = useCallback((session: Session | null) => {
    setUser(mapAuthUser(session?.user ?? null))
    scheduleTokenRefresh({
      session,
      refreshTimerRef,
      refreshInProgressRef,
      onSessionUpdated: applySession,
    })
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const { user: recoveredUser, session } = await recoverAuthSession()
        setUser(recoveredUser)
        if (session) {
          applySession(session)
        }
      } catch (e) {
        console.warn('[Canmou] Auth init failed:', e)
      } finally {
        setLoading(false)
      }
    }
    void init()

    let sub: { unsubscribe: () => void } | undefined
    try {
      sub = subscribeToAuthState((nextUser, session) => {
        setUser(nextUser)
        scheduleTokenRefresh({
          session,
          refreshTimerRef,
          refreshInProgressRef,
          onSessionUpdated: applySession,
        })
      })
    } catch (e) {
      console.warn('[Canmou] Auth subscription failed:', e)
    }

    return () => {
      sub?.unsubscribe()
      clearRefreshTimer(refreshTimerRef)
    }
  }, [applySession])

  // Tauri OAuth 弹窗完成后，接收 token 并设置会话
  useEffect(() => {
    if (!isTauriRuntime()) return
    let unlisten: (() => void) | null = null
    void registerOAuthCompleteListener({
      onStart: () => setAuthInProgress(true),
      onFinish: () => setAuthInProgress(false),
      onError: (error) => {
        console.warn('[Canmou] OAuth setSession failed:', error)
      },
    }).then((fn) => {
      unlisten = fn
    })
    return () => { unlisten?.() }
  }, [])

  const signOut = useCallback(async () => {
    await signOutAuthSession()
    setUser(null)
    clearRefreshTimer(refreshTimerRef)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
      {authInProgress && (
        <AppLoading variant="overlay" label="正在登录..." />
      )}
    </AuthContext.Provider>
  )
}
