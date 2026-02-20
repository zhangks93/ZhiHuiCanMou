import { useMemo } from 'react'
import { env } from '@/config/env'

const FEISHU_AUTH_URL = 'https://open.feishu.cn/open-apis/authen/v1/authorize'

function generateState() {
  return window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export function Login() {
  const state = useMemo(generateState, [])
  const { appId, redirectUri, scope } = env.feishu
  const canLogin = Boolean(appId && redirectUri)

  const handleFeishuLogin = () => {
    if (!canLogin) return
    const loginUrl = new URL(FEISHU_AUTH_URL)
    loginUrl.searchParams.set('app_id', appId)
    loginUrl.searchParams.set('redirect_uri', redirectUri)
    loginUrl.searchParams.set('scope', scope)
    loginUrl.searchParams.set('state', state)
    window.location.href = loginUrl.toString()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-[var(--color-border)] p-8 shadow-card-hover animate-slide-up">
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-white text-xl font-semibold mx-auto mb-6 shadow-inner-soft">
          智
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-text-strong)] text-center mb-1 font-serif">
          智汇参谋登录
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] text-center mb-8">
          使用飞书账号一键登录
        </p>

        <button
          type="button"
          onClick={handleFeishuLogin}
          disabled={!canLogin}
          className="w-full h-12 inline-flex items-center justify-center gap-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-card hover:shadow-card-hover"
        >
          <span className="w-6 h-6 rounded-md bg-white/90 text-accent text-xs font-bold flex items-center justify-center">
            飞
          </span>
          <span>使用飞书登录</span>
        </button>

        {!canLogin && (
          <p className="mt-4 text-sm text-warning-700 text-center">
            未配置飞书登录，请设置 VITE_FEISHU_APP_ID 和 VITE_FEISHU_REDIRECT_URI
          </p>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-text-muted)] text-center">
          登录即表示你已阅读并同意本系统的相关条款。
        </p>
      </div>
    </div>
  )
}
