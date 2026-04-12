import type { MutableRefObject } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, getUserDisplayInfo } from '@/shared/lib/supabase'
import type { AuthUser } from '@/app/providers/AuthContext'
import { storeSessionToken, getSessionToken, clearSessionToken } from '@/shared/lib/auth-storage'

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

export function mapAuthUser(rawUser: User | null): AuthUser | null {
  if (!rawUser) return null
  return getUserDisplayInfo(rawUser)
}

export async function recoverAuthSession(): Promise<{
  user: AuthUser | null
  session: Session | null
}> {
  const storedToken = getSessionToken()

  if (storedToken) {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (session && !error) {
      return {
        user: mapAuthUser(session.user),
        session,
      }
    }

    clearSessionToken()
    return { user: null, session: null }
  }

  const { data: { user } } = await supabase.auth.getUser()
  return {
    user: mapAuthUser(user),
    session: null,
  }
}

export function subscribeToAuthState(
  onChange: (user: AuthUser | null, session: Session | null) => void,
): { unsubscribe: () => void } {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(mapAuthUser(session?.user ?? null), session)
  })

  return subscription
}

export function clearRefreshTimer(refreshTimerRef: MutableRefObject<number | null>) {
  if (refreshTimerRef.current) {
    clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = null
  }
}

export function scheduleTokenRefresh(params: {
  session: Session | null
  refreshTimerRef: MutableRefObject<number | null>
  refreshInProgressRef: MutableRefObject<boolean>
  onSessionUpdated: (session: Session | null) => void
}) {
  const { session, refreshTimerRef, refreshInProgressRef, onSessionUpdated } = params

  clearRefreshTimer(refreshTimerRef)
  if (!session) return

  const expiresIn = session.expires_in || 3600
  storeSessionToken(session.access_token, expiresIn)

  const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + expiresIn * 1000
  const timeUntilRefresh = expiresAt - Date.now() - REFRESH_THRESHOLD_MS

  if (timeUntilRefresh > 0) {
    refreshTimerRef.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (error) {
          console.error('[Canmou] Auto-refresh failed:', error)
          return
        }
        onSessionUpdated(data.session ?? null)
      } catch (error) {
        console.error('[Canmou] Auto-refresh error:', error)
      }
    }, timeUntilRefresh)
    return
  }

  if (refreshInProgressRef.current) {
    return
  }

  refreshInProgressRef.current = true
  supabase.auth.refreshSession()
    .then(({ data, error }) => {
      refreshInProgressRef.current = false
      if (error) {
        console.error('[Canmou] Immediate refresh failed:', error)
        return
      }
      onSessionUpdated(data.session ?? null)
    })
    .catch((error) => {
      refreshInProgressRef.current = false
      console.error('[Canmou] Immediate refresh error:', error)
    })
}

export async function setOAuthSessionTokens(accessToken: string, refreshToken: string) {
  return supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
}

export async function signOutAuthSession() {
  await supabase.auth.signOut()
  clearSessionToken()
}
