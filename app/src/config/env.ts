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
} as const

export function validateEnv(): void {
  if (!env.supabase.url) {
    console.warn('[Canmou] VITE_SUPABASE_URL is not set. Supabase features will not work.')
  }
  if (!env.supabase.anonKey) {
    console.warn('[Canmou] VITE_SUPABASE_ANON_KEY is not set. Supabase features will not work.')
  }
}
