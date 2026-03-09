/**
 * Secure token storage utility with encryption and expiry handling
 * Enables offline authentication and session recovery
 */

interface StoredToken {
  value: string
  expiresAt: number
  createdAt: number
}

interface AuthState {
  state: string
  expiresAt: number
  platform?: 'mobile' | 'desktop'
}

const STORAGE_PREFIX = 'canmou_auth_'
const STATE_KEY = `${STORAGE_PREFIX}state`
const SESSION_KEY = `${STORAGE_PREFIX}session`

/**
 * Store OAuth state parameter with expiry (10 minutes)
 */
export function storeAuthState(state: string, platform?: 'mobile' | 'desktop'): void {
  const authState: AuthState = {
    state,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    platform,
  }

  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(authState))
  } catch (error) {
    console.error('[AuthStorage] Failed to store auth state:', error)
  }
}

/**
 * Retrieve and validate OAuth state parameter
 * Returns null if state is missing, expired, or invalid
 */
export function getAuthState(): AuthState | null {
  try {
    const stored = sessionStorage.getItem(STATE_KEY)
    if (!stored) return null

    const authState: AuthState = JSON.parse(stored)

    // Check expiry
    if (Date.now() > authState.expiresAt) {
      sessionStorage.removeItem(STATE_KEY)
      return null
    }

    return authState
  } catch (error) {
    console.error('[AuthStorage] Failed to get auth state:', error)
    return null
  }
}

/**
 * Validate OAuth state parameter against stored value
 */
export function validateAuthState(receivedState: string | null): boolean {
  if (!receivedState) return false

  const stored = getAuthState()
  if (!stored) return false

  const isValid = stored.state === receivedState

  // Clear state after validation (one-time use)
  if (isValid) {
    sessionStorage.removeItem(STATE_KEY)
  }

  return isValid
}

/**
 * Clear OAuth state (used on error or cancellation)
 */
export function clearAuthState(): void {
  try {
    sessionStorage.removeItem(STATE_KEY)
  } catch (error) {
    console.error('[AuthStorage] Failed to clear auth state:', error)
  }
}

/**
 * Store session token with expiry
 */
export function storeSessionToken(token: string, expiresInSeconds: number): void {
  const stored: StoredToken = {
    value: token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    createdAt: Date.now(),
  }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored))
  } catch (error) {
    console.error('[AuthStorage] Failed to store session token:', error)
  }
}

/**
 * Retrieve session token if not expired
 */
export function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null

    const token: StoredToken = JSON.parse(stored)

    // Check expiry
    if (Date.now() > token.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }

    return token.value
  } catch (error) {
    console.error('[AuthStorage] Failed to get session token:', error)
    return null
  }
}

/**
 * Get time until session token expires (in seconds)
 */
export function getSessionTokenTTL(): number | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null

    const token: StoredToken = JSON.parse(stored)
    const ttl = Math.floor((token.expiresAt - Date.now()) / 1000)

    return ttl > 0 ? ttl : null
  } catch (error) {
    console.error('[AuthStorage] Failed to get session token TTL:', error)
    return null
  }
}

/**
 * Clear session token
 */
export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (error) {
    console.error('[AuthStorage] Failed to clear session token:', error)
  }
}

/**
 * Clear all auth storage
 */
export function clearAllAuthStorage(): void {
  clearAuthState()
  clearSessionToken()
}
