import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { env } from '@/app/config/env'
import { storeAuthState } from '@/shared/lib/auth-storage'

const FEISHU_AUTH_URL = 'https://open.feishu.cn/open-apis/authen/v1/authorize'

function generateState() {
  return window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function isTauriApp() {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

function isMobile() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function Login() {
  const state = useMemo(generateState, [])
  const { appId, redirectUri, scope } = env.feishu
  const canLogin = Boolean(appId && redirectUri)
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showFallback, setShowFallback] = useState(false)
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null)

  const addDebugInfo = (message: string) => {
    console.log('[Canmou Login]', message)
    setDebugInfo((previous) => [...previous, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    if (!isTauriApp()) return

    const preloadModules = async () => {
      try {
        if (isMobile()) {
          await import('@tauri-apps/plugin-opener')
          addDebugInfo('Preloaded mobile opener plugin')
        } else {
          await import('@tauri-apps/api/webviewWindow')
          addDebugInfo('Preloaded desktop webview window')
        }
      } catch (error) {
        console.error('[Canmou] Failed to preload Tauri modules:', error)
      }
    }

    void preloadModules()
  }, [])

  useEffect(() => {
    if (!isTauriApp() || !isMobile()) return

    let unlisten: (() => void) | null = null
    void import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ code: string; message: string }>('deep-link:error', (event) => {
          const { code, message } = event.payload
          addDebugInfo(`Deep link error: ${code} - ${message}`)
          setDeepLinkError(message)
          setShowFallback(true)
          setIsLoading(false)
        })
      )
      .then((fn) => {
        unlisten = fn
      })

    return () => {
      unlisten?.()
    }
  }, [])

  const handleFeishuLogin = async () => {
    if (!canLogin || isLoading) return

    setIsLoading(true)
    setDebugInfo([])

    try {
      const mobile = isMobile()
      const tauri = isTauriApp()
      addDebugInfo(`Environment: ${tauri ? 'Tauri' : 'Web'} / ${mobile ? 'mobile' : 'desktop'}`)

      storeAuthState(state, mobile ? 'mobile' : 'desktop')
      addDebugInfo(`Stored auth state: ${state.slice(0, 8)}...`)

      const loginUrl = new URL(FEISHU_AUTH_URL)
      loginUrl.searchParams.set('app_id', appId)
      loginUrl.searchParams.set('redirect_uri', mobile ? `${redirectUri}?platform=mobile` : redirectUri)
      loginUrl.searchParams.set('scope', scope)
      loginUrl.searchParams.set('state', state)

      const urlString = loginUrl.toString()
      addDebugInfo(`Auth URL ready`)

      if (tauri && !mobile) {
        addDebugInfo('Opening desktop auth window')
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        const oauthWindow = new WebviewWindow('oauth', {
          url: urlString,
          title: 'Feishu Sign In',
          width: 520,
          height: 720,
        })

        oauthWindow.once('tauri://error', (event) => {
          addDebugInfo(`OAuth window error: ${JSON.stringify(event)}`)
          setIsLoading(false)
        })
        oauthWindow.once('tauri://destroyed', () => {
          addDebugInfo('OAuth window closed')
          setIsLoading(false)
        })
      } else if (tauri && mobile) {
        addDebugInfo('Opening system browser')
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(urlString)
        addDebugInfo('Waiting for deep link callback')

        window.setTimeout(() => {
          setIsLoading((current) => {
            if (current) addDebugInfo('Auth callback timeout, please retry if login did not complete')
            return false
          })
        }, 30000)
      } else {
        addDebugInfo('Redirecting in current window')
        window.location.href = urlString
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addDebugInfo(`Login error: ${message}`)
      console.error('[Canmou] Login error:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />

      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
        <div className="absolute -right-20 -top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.12),transparent_65%)] animate-pulse-glow" />
        <div className="absolute -bottom-16 -left-16 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.09),transparent_65%)] animate-pulse-glow [animation-delay:1.2s]" />
      </div>

      <div className="w-full max-w-[380px] animate-slide-up">
        {/* Logo + Title */}
        <div className="mb-8 flex flex-col items-center">
          {/* Logo mark with orbit ring */}
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-950 text-[15px] font-semibold tracking-[0.2em] text-white shadow-[0_20px_48px_rgba(15,23,42,0.22)]">
              CM
            </div>
            {/* Orbit ring */}
            <div className="absolute -inset-3 rounded-[30px] border border-[rgba(37,99,235,0.12)]" style={{ animation: 'orbit 20s linear infinite' }} />
          </div>

          <h1 className="mt-6 text-center text-[22px] font-semibold leading-tight text-[var(--color-text-strong)]">
            智汇参谋
          </h1>
          <p className="mt-1.5 text-center text-[13px] leading-6 text-[var(--color-text-muted)]">
            教育后勤智慧决策平台
          </p>
        </div>

        {/* Sign-in card — glass morphism */}
        <div className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white/60 px-6 py-7 shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          {/* Top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(37,99,235,0.28)] to-transparent" />

          {/* Shimmer overlay when loading */}
          {isLoading && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(37,99,235,0.04)] to-transparent" style={{ animation: 'shimmer 2s ease-in-out infinite' }} />
            </div>
          )}

          <button
            type="button"
            onClick={handleFeishuLogin}
            disabled={!canLogin || isLoading}
            className="group relative flex w-full items-center justify-between rounded-[20px] border border-[rgba(37,99,235,0.12)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-4 text-left text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <div>
              <div className="text-sm font-semibold">飞书账号登录</div>
              <div className="mt-0.5 text-[13px] text-slate-400">
                {isLoading ? '正在跳转至授权页面...' : '使用组织身份进行认证'}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/[0.08] backdrop-blur-sm transition-all duration-200 group-hover:bg-white/[0.12]">
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              )}
            </div>
          </button>

          {!canLogin && (
            <div className="mt-4 rounded-2xl border border-[rgba(220,38,38,0.12)] bg-[rgba(220,38,38,0.04)] px-4 py-3 text-sm leading-6 text-[var(--color-error)]">
              飞书登录未配置，请检查环境变量。
            </div>
          )}

          {showFallback && deepLinkError && (
            <div className="mt-4 rounded-2xl border border-[rgba(217,119,6,0.14)] bg-[rgba(217,119,6,0.04)] px-4 py-4 text-sm leading-7">
              <div className="font-semibold text-[var(--color-text-strong)]">回调失败</div>
              <div className="mt-1 text-[var(--color-text-muted)]">{deepLinkError}</div>
              <button
                type="button"
                onClick={() => {
                  setShowFallback(false)
                  setDeepLinkError(null)
                  setDebugInfo([])
                }}
                className="btn btn-sm mt-3"
              >
                重置状态
              </button>
            </div>
          )}

          <p className="mt-5 text-center text-[12px] leading-5 text-[var(--color-text-muted)]/60">
            登录即表示您将通过组织飞书账号完成身份验证
          </p>
        </div>

        {/* Version tag */}
        <div className="mt-5 text-center text-[11px] tracking-[0.12em] text-[var(--color-text-muted)]/40">
          CANMOU v1.0
        </div>

        {/* Debug log */}
        {debugInfo.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white/40 p-4 backdrop-blur-lg">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Debug
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-[11px] leading-5 text-[var(--color-text-muted)]">
              {debugInfo.map((info) => (
                <div key={info}>{info}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
