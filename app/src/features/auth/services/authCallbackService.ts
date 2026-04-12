import { clearAuthState, validateAuthState } from '@/shared/lib/auth-storage'
import { retrySetSession } from '@/shared/lib/auth-retry'
import { createAuthError, getAuthError, type AuthError } from '@/shared/lib/auth-errors'
import { supabase } from '@/shared/lib/supabase'
import { closeCurrentOAuthWindow, emitOAuthComplete, isTauriRuntime } from './tauriOAuthService'

export interface ParsedAuthCallbackParams {
  accessToken: string | null
  refreshToken: string | null
  state: string | null
  debugDetails: string[]
}

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const paramPart = fragment.includes('#') ? (fragment.split('#').pop() ?? '') : fragment
  new URLSearchParams(paramPart).forEach((value, key) => {
    params[key] = value
  })
  return params
}

function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {}

  if (url.includes('#')) {
    const hashPart = url.split('#').pop() ?? ''
    new URLSearchParams(hashPart).forEach((value, key) => {
      params[key] = value
    })
  }

  if (url.includes('?')) {
    const queryPart = url.split('?').pop()?.split('#')[0] ?? ''
    new URLSearchParams(queryPart).forEach((value, key) => {
      params[key] = value
    })
  }

  return params
}

export function parseAuthCallbackParams(location: Location): ParsedAuthCallbackParams {
  const fullUrl = location.href
  const debugDetails = [
    `回调路径: ${location.pathname || '/'}`,
    `Hash 长度: ${location.hash.length}`,
    `Search 长度: ${location.search.length}`,
  ]

  const hashParams = parseHashParams(location.hash)
  const urlParams = parseUrlParams(fullUrl)
  const searchParams = parseUrlParams(location.search)
  const params = { ...urlParams, ...searchParams, ...hashParams }

  debugDetails.push(`已解析 access_token=${params.access_token ? 'yes' : 'no'}, refresh_token=${params.refresh_token ? 'yes' : 'no'}, state=${params.state ? 'yes' : 'no'}`)

  return {
    accessToken: params.access_token ?? null,
    refreshToken: params.refresh_token ?? null,
    state: params.state ?? null,
    debugDetails,
  }
}

export function validateCallbackState(state: string | null): AuthError | null {
  if (state) {
    return validateAuthState(state) ? null : getAuthError('STATE_VALIDATION_FAILED')
  }

  clearAuthState()
  return null
}

export function getAuthRuntime() {
  const isTauri = isTauriRuntime()
  const isMobileDevice =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  return {
    isTauri,
    isMobileDevice,
  }
}

export async function completeDesktopOAuth(accessToken: string, refreshToken: string) {
  await emitOAuthComplete(accessToken, refreshToken)
  window.setTimeout(() => {
    void closeCurrentOAuthWindow()
  }, 1500)
}

export async function completeBrowserOAuth(params: {
  accessToken: string
  refreshToken: string
  onRetry: (attempt: number, error: unknown) => void
}): Promise<{ attempts: number; authError: AuthError | null }> {
  const result = await retrySetSession(
    () => supabase.auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken }),
    params.onRetry,
  )

  if (!result.success) {
    const error = result.error as { code?: string; message?: string } | undefined
    return {
      attempts: result.attempts,
      authError: error?.code ? getAuthError(error.code) : createAuthError(error),
    }
  }

  return {
    attempts: result.attempts,
    authError: null,
  }
}

export async function waitForAuthenticatedUser(maxChecks = 10, delayMs = 300) {
  for (let index = 0; index < maxChecks; index += 1) {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (user && !error) {
      return {
        ready: true,
        checkCount: index + 1,
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  return {
    ready: false,
    checkCount: maxChecks,
  }
}
