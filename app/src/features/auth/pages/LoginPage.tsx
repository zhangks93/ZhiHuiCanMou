import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { env } from '@/app/config/env'
import { storeAuthState } from '@/shared/lib/auth-storage'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { logger } from '@/shared/lib/logger'
import { isTauriRuntime } from '@/shared/lib/tauri'
import { AppBrandMark } from '@/shared/ui/AppBrandMark'

const FEISHU_AUTH_URL = 'https://open.feishu.cn/open-apis/authen/v1/authorize'

function generateState() {
  return window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export function Login() {
  const state = useMemo(generateState, [])
  const { appId, redirectUri, scope } = env.feishu
  const canLogin = Boolean(appId && redirectUri)
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (message: string) => {
    logger.debug(`Login debug: ${message}`)
    setDebugInfo((previous) => [...previous, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const handleFeishuLogin = async () => {
    if (!canLogin || isLoading) return

    setIsLoading(true)
    setDebugInfo([])

    try {
      const tauri = isTauriRuntime()
      addDebugInfo(`Environment: ${tauri ? 'Tauri' : 'Web'} / desktop`)

      storeAuthState(state, 'desktop')
      addDebugInfo(`Stored auth state: ${state.slice(0, 8)}...`)

      const loginUrl = new URL(FEISHU_AUTH_URL)
      loginUrl.searchParams.set('app_id', appId)
      loginUrl.searchParams.set('redirect_uri', redirectUri)
      loginUrl.searchParams.set('scope', scope)
      loginUrl.searchParams.set('state', state)

      const urlString = loginUrl.toString()
      addDebugInfo(`Auth URL ready`)

      if (tauri) {
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
      } else {
        addDebugInfo('Redirecting in current window')
        window.location.href = urlString
      }
    } catch (error) {
      const message = getErrorMessage(error, '登录失败')
      addDebugInfo(`Login error: ${message}`)
      logger.error('Login error', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />

      <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
        <div className="absolute -right-20 -top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(95,127,188,0.14),transparent_65%)] animate-pulse-glow" />
        <div className="absolute -bottom-16 -left-16 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.09),transparent_65%)] animate-pulse-glow [animation-delay:1.2s]" />
      </div>

      <div className="w-full max-w-[380px] animate-slide-up">
        <div className="mb-8 flex flex-col items-center">
          <AppBrandMark size="lg" ringTone="accent" animated />

          <h1 className="mt-6 text-center text-title font-semibold leading-tight text-[var(--color-text-strong)]">
            智汇参谋
          </h1>
          <p className="mt-1.5 text-center text-body leading-6 text-[var(--color-text-muted)]">
            教育后勤智慧决策平台
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white/60 px-6 py-7 shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(95,127,188,0.24)] to-transparent" />

          {isLoading && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(95,127,188,0.05)] to-transparent" style={{ animation: 'shimmer 2s ease-in-out infinite' }} />
            </div>
          )}

          <button
            type="button"
            onClick={handleFeishuLogin}
            disabled={!canLogin || isLoading}
            className="group relative flex w-full items-center justify-between rounded-[20px] border border-[rgba(95,127,188,0.16)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-4 text-left text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <div>
              <div className="text-body font-semibold">飞书账号登录</div>
              <div className="mt-0.5 text-body text-slate-400">
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
            <div className="mt-4 rounded-2xl border border-[rgba(220,38,38,0.12)] bg-[rgba(220,38,38,0.04)] px-4 py-3 text-body leading-6 text-[var(--color-error)]">
              飞书登录未配置，请检查环境变量。
            </div>
          )}

          <p className="mt-5 text-center text-caption leading-5 text-[var(--color-text-muted)]/60">
            登录即表示您将通过组织飞书账号完成身份验证
          </p>
        </div>

        <div className="mt-5 text-center text-caption tracking-[0.12em] text-[var(--color-text-muted)]/40">
          CANMOU v1.0
        </div>

        {debugInfo.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white/40 p-4 backdrop-blur-lg">
            <div className="mb-2 text-caption font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Debug
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-caption leading-5 text-[var(--color-text-muted)]">
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
