import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { env } from '@/config/env'
import { storeAuthState } from '@/lib/auth-storage'

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
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_28%)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="px-2 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
            <ShieldCheck size={14} className="text-[var(--color-accent)]" />
            Secure workspace
          </div>

          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-tight text-[var(--color-text-strong)] sm:text-6xl">
            A lighter command center for operations and business intelligence.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--color-text-muted)] sm:text-lg">
            Sign in with Feishu to access scheduling, business data, AI workflows, and the redesigned workspace shell.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              'Modular navigation with cleaner information hierarchy',
              'Data-heavy pages tuned for faster scanning',
              'AI workspace integrated into the same system layer',
            ].map((item) => (
              <div key={item} className="app-card rounded-2xl px-4 py-4 text-sm leading-6 text-[var(--color-text-muted)]">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="app-panel app-panel-strong relative overflow-hidden rounded-[32px] px-6 py-7 sm:px-8 sm:py-9">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(37,99,235,0.45)] to-transparent" />

          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-950 text-sm font-semibold tracking-[0.2em] text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)]">
              CM
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                Canmou
              </div>
              <div className="text-2xl font-semibold text-[var(--color-text-strong)]">Workspace sign in</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFeishuLogin}
            disabled={!canLogin || isLoading}
            className="group flex w-full items-center justify-between rounded-[22px] bg-slate-950 px-5 py-4 text-left text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <div>
              <div className="text-sm font-semibold">Continue with Feishu</div>
              <div className="mt-1 text-sm text-slate-300">
                {isLoading ? 'Redirecting to authorization...' : 'Use your existing organization identity'}
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {!canLogin && (
            <div className="mt-4 rounded-2xl border border-[rgba(220,38,38,0.16)] bg-[rgba(220,38,38,0.06)] px-4 py-3 text-sm text-[var(--color-error)]">
              Feishu login is not configured. Check the environment variables before continuing.
            </div>
          )}

          {showFallback && deepLinkError && (
            <div className="mt-4 rounded-2xl border border-[rgba(217,119,6,0.18)] bg-[rgba(217,119,6,0.08)] px-4 py-4 text-sm leading-7 text-[var(--color-text)]">
              <div className="font-semibold text-[var(--color-text-strong)]">Deep link callback failed</div>
              <div className="mt-1 text-[var(--color-text-muted)]">{deepLinkError}</div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-[var(--color-text-muted)]">
                <li>Return to the Feishu authorization page and retry the flow.</li>
                <li>Confirm the app is installed with the correct deep link registration.</li>
                <li>Restart the app if the callback was interrupted.</li>
              </ol>
              <button
                type="button"
                onClick={() => {
                  setShowFallback(false)
                  setDeepLinkError(null)
                  setDebugInfo([])
                }}
                className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-surface-muted)]"
              >
                Reset status
              </button>
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-[rgba(15,23,42,0.04)] px-4 py-4 text-sm leading-7 text-[var(--color-text-muted)]">
            Signing in means your session is validated through your organization’s Feishu account and redirected back into this workspace.
          </div>

          {debugInfo.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white/80 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Debug log
              </div>
              <div className="max-h-52 overflow-y-auto font-mono text-[11px] leading-6 text-[var(--color-text-muted)]">
                {debugInfo.map((info) => (
                  <div key={info}>{info}</div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
