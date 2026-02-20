import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase, getUserDisplayInfo } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthUser = { name: string; avatarUrl?: string }

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
