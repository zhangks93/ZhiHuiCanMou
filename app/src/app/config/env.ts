/**
 * Environment configuration with validation
 * All env vars used at runtime must be defined here
 */
import { logger } from '@/shared/lib/logger'

function getEnv(key: string, defaultValue?: string): string {
  const value = import.meta.env[key] ?? defaultValue ?? ''
  return String(value).trim()
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = import.meta.env[key]
  if (value === undefined || value === '') return defaultValue
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? defaultValue : parsed
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = import.meta.env[key]
  if (value === undefined || value === '') return defaultValue
  return String(value).toLowerCase() === 'true'
}

const defaultLinks = {
  safety: 'https://saas.hailiangedu.com/',
  qinghe: 'https://lms.hailiangedu.com/logistics-saas-center/',
  haiding: 'https://machining.hailiangedu.com/',
  catering: 'https://i.hailiangedu.com/login?sysCode=catering-admin',
  crm: 'https://www.fxiaoke.com/',
  guanhai:
    'https://hailiang.feishu.cn/base/HdVSbRRs3ahb1fsxId6cpyEunSg?table=tblxumeOS2l72YkL&view=vewjPpI3IC',
} as const

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
  /** Authentication configuration */
  auth: {
    /** Timeout for authentication operations (ms) */
    timeoutMs: getEnvNumber('VITE_AUTH_TIMEOUT_MS', 30000),
    /** Number of retry attempts for failed auth operations */
    retryAttempts: getEnvNumber('VITE_AUTH_RETRY_ATTEMPTS', 3),
    /** Initial delay between retries (ms) */
    retryDelayMs: getEnvNumber('VITE_AUTH_RETRY_DELAY_MS', 2000),
    /** Enable state validation for CSRF protection */
    enableStateValidation: getEnvBoolean('VITE_AUTH_ENABLE_STATE_VALIDATION', true),
    /** Enable auth analytics tracking */
    enableAnalytics: getEnvBoolean('VITE_AUTH_ENABLE_ANALYTICS', true),
    /** Enable debug mode (shows detailed logs) */
    enableDebug: getEnvBoolean('VITE_AUTH_ENABLE_DEBUG', false),
  },
  links: {
    // Keep system entry links available in packaged builds even if the packager
    // did not load a local .env file. Environment values still override defaults.
    safety: getEnv('VITE_LINK_SAFETY_URL', defaultLinks.safety),
    qinghe: getEnv('VITE_LINK_QINGHE_URL', defaultLinks.qinghe),
    haiding: getEnv('VITE_LINK_HAIDING_URL', defaultLinks.haiding),
    catering: getEnv('VITE_LINK_CATERING_URL', defaultLinks.catering),
    crm: getEnv('VITE_LINK_CRM_URL', defaultLinks.crm),
    guanhai: getEnv('VITE_LINK_GUANHAI_URL', defaultLinks.guanhai),
  },
} as const

export function validateEnv(): void {
  if (!env.supabase.url) {
    logger.warn('VITE_SUPABASE_URL is not set. Supabase features will not work.')
  }
  if (!env.supabase.anonKey) {
    logger.warn('VITE_SUPABASE_ANON_KEY is not set. Supabase features will not work.')
  }
}
