import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase, getUserDisplayInfo } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { AuthContext } from './AuthContextDefinition'
import type { AuthUser } from './AuthContextDefinition'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

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
            await supabase.auth.setSession({ access_token, refresh_token })
          } catch (err) {
            console.warn('[Canmou] OAuth setSession failed:', err)
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
    </AuthContext.Provider>
  )
}
