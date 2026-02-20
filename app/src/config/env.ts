/**
 * Environment configuration with validation
 * All env vars used at runtime must be defined here
 */

function getEnv(key: string, defaultValue?: string): string {
  const value = import.meta.env[key] ?? defaultValue ?? ''
  return String(value).trim()
}

export const env = {
  supabase: {
    url: getEnv('VITE_SUPABASE_URL'),
    anonKey: getEnv('VITE_SUPABASE_ANON_KEY'),
  },
  feishu: {
    appId: getEnv('VITE_FEISHU_APP_ID'),
    redirectUri: getEnv('VITE_FEISHU_REDIRECT_URI', ''),
    scope: getEnv('VITE_FEISHU_SCOPE', 'contact:user.base:readonly'),
  },
  /** OAuth 回调 URL，需与 Supabase Edge Function 的 FEISHU_LOGIN_REDIRECT_TO 一致 */
  authCallbackUrl: getEnv(
    'VITE_AUTH_CALLBACK_URL',
    typeof window !== 'undefined' ? `${window.location.origin}/#/auth-callback` : ''
  ),
} as const

export function validateEnv(): void {
  if (!env.supabase.url) {
    console.warn('[Canmou] VITE_SUPABASE_URL is not set. Supabase features will not work.')
  }
  if (!env.supabase.anonKey) {
    console.warn('[Canmou] VITE_SUPABASE_ANON_KEY is not set. Supabase features will not work.')
  }
}
