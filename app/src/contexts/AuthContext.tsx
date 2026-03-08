import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase, getUserDisplayInfo } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { AuthContext } from './AuthContextDefinition'
import type { AuthUser } from './AuthContextDefinition'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authInProgress, setAuthInProgress] = useState(false)

  const updateUser = useCallback((rawUser: User | null) => {
    if (!rawUser) {
      setUser(null)
      return
    }
    setUser(getUserDisplayInfo(rawUser))
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        updateUser(u)
      } catch (e) {
        console.warn('[Canmou] Auth init failed:', e)
      } finally {
        setLoading(false)
      }
    }
    init()

    let sub: { unsubscribe: () => void } | undefined
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        updateUser(session?.user ?? null)
      })
      sub = subscription
    } catch (e) {
      console.warn('[Canmou] Auth subscription failed:', e)
    }

    return () => sub?.unsubscribe()
  }, [updateUser])

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
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
      {authInProgress && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            textAlign: 'center',
            color: 'white',
            fontFamily: 'Inter, sans-serif'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(251, 191, 36, 0.3)',
              borderTopColor: '#fbbf24',
              borderRadius: '50%',
              margin: '0 auto 1rem',
              animation: 'spin 0.8s linear infinite'
            }}></div>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>正在登录...</p>
          </div>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </AuthContext.Provider>
  )
}
