import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { supabase, getUserDisplayInfo } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { AuthContext } from './AuthContextDefinition'
import type { AuthUser } from './AuthContextDefinition'
import { storeSessionToken, getSessionToken, clearSessionToken } from '@/lib/auth-storage'

// Refresh token 5 minutes before expiry
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authInProgress, setAuthInProgress] = useState(false)
  const refreshTimerRef = useRef<number | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const refreshInProgressRef = useRef<boolean>(false)

  const updateUser = useCallback((rawUser: User | null) => {
    if (!rawUser) {
      setUser(null)
      clearSessionToken()
      return
    }
    setUser(getUserDisplayInfo(rawUser))
  }, [])

  // Schedule token refresh before expiry
  const scheduleTokenRefresh = useCallback((session: Session | null) => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    if (!session) return

    sessionRef.current = session

    // Store session token with expiry
    const expiresIn = session.expires_in || 3600
    storeSessionToken(session.access_token, expiresIn)

    // Calculate time until refresh (5 minutes before expiry)
    // IMPORTANT: expires_at is in UNIX seconds, not milliseconds
    const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + expiresIn * 1000
    const timeUntilRefresh = expiresAt - Date.now() - REFRESH_THRESHOLD_MS

    console.log(`[Canmou] Token expires at: ${new Date(expiresAt).toLocaleString()}, time until refresh: ${Math.round(timeUntilRefresh / 1000)}s`)

    if (timeUntilRefresh > 0) {
      console.log(`[Canmou] Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000)}s`)
      refreshTimerRef.current = window.setTimeout(async () => {
        console.log('[Canmou] Auto-refreshing session...')
        try {
          const { data, error } = await supabase.auth.refreshSession()
          if (error) {
            console.error('[Canmou] Auto-refresh failed:', error)
            // If refresh fails, user will need to re-authenticate
            return
          }
          if (data.session) {
            console.log('[Canmou] Session refreshed successfully')
            scheduleTokenRefresh(data.session)
          }
        } catch (err) {
          console.error('[Canmou] Auto-refresh error:', err)
        }
      }, timeUntilRefresh)
    } else {
      // Token already expired or about to expire, refresh immediately
      // But prevent multiple simultaneous refresh attempts
      if (refreshInProgressRef.current) {
        console.log('[Canmou] Refresh already in progress, skipping...')
        return
      }

      console.log('[Canmou] Token expired, refreshing immediately...')
      refreshInProgressRef.current = true
      supabase.auth.refreshSession().then(({ data, error }) => {
        refreshInProgressRef.current = false
        if (error) {
          console.error('[Canmou] Immediate refresh failed:', error)
          return
        }
        if (data.session) {
          scheduleTokenRefresh(data.session)
        }
      }).catch((err) => {
        refreshInProgressRef.current = false
        console.error('[Canmou] Immediate refresh error:', err)
      })
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        // Try to recover session from storage
        const storedToken = getSessionToken()
        if (storedToken) {
          console.log('[Canmou] Found stored session, attempting recovery...')
          // Validate stored session
          const { data: { session }, error } = await supabase.auth.getSession()
          if (session && !error) {
            console.log('[Canmou] Session recovered successfully')
            updateUser(session.user)
            scheduleTokenRefresh(session)
          } else {
            console.log('[Canmou] Stored session invalid, clearing...')
            clearSessionToken()
          }
        } else {
          // No stored session, check current session
          const { data: { user: u } } = await supabase.auth.getUser()
          updateUser(u)
        }
      } catch (e) {
        console.warn('[Canmou] Auth init failed:', e)
      } finally {
        setLoading(false)
      }
    }
    init()

    let sub: { unsubscribe: () => void } | undefined
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Canmou AuthContext] Auth state changed:', event, session?.user?.id ? 'User logged in' : 'No user')
        updateUser(session?.user ?? null)
        scheduleTokenRefresh(session)
      })
      sub = subscription
    } catch (e) {
      console.warn('[Canmou] Auth subscription failed:', e)
    }

    return () => {
      sub?.unsubscribe()
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [updateUser, scheduleTokenRefresh])

  // Tauri OAuth 弹窗完成后，接收 token 并设置会话
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI__' in window)) return
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ access_token?: string; refresh_token?: string }>('auth:oauth-complete', async (e) => {
          const { access_token, refresh_token } = e.payload ?? {}
          if (!access_token || !refresh_token) return
          try {
            setAuthInProgress(true)
            console.log('[Canmou] Received OAuth tokens, setting session...')
            await supabase.auth.setSession({ access_token, refresh_token })
            console.log('[Canmou] Session set successfully')
          } catch (err) {
            console.warn('[Canmou] OAuth setSession failed:', err)
          } finally {
            setAuthInProgress(false)
          }
        })
      )
      .then((fn) => {
        unlisten = fn
      })
    return () => { unlisten?.() }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    clearSessionToken()
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    sessionRef.current = null
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
      {authInProgress && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(15,23,42,0.12)] backdrop-blur-lg animate-fade-in">
          <div className="flex flex-col items-center gap-5 rounded-[28px] border border-[var(--color-border)] bg-white/60 px-12 py-10 shadow-[0_24px_64px_rgba(15,23,42,0.10)] backdrop-blur-xl animate-scale-in">
            {/* Logo */}
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-slate-950 text-[10px] font-semibold tracking-[0.2em] text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)]">
                CM
              </div>
              <div className="absolute -inset-2 rounded-[22px] border border-[rgba(37,99,235,0.12)]" style={{ animation: 'orbit 10s linear infinite' }} />
            </div>

            {/* Spinner */}
            <div className="relative">
              <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-[rgba(148,163,184,0.14)] border-t-[var(--color-accent)]" />
            </div>

            <p className="text-sm font-medium text-[var(--color-text-strong)]">正在登录...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}
