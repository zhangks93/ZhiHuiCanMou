import { useMemo } from 'react'
import { env } from '@/config/env'

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

  const handleFeishuLogin = async () => {
    if (!canLogin) return
    const mobile = isMobile()
    const isTauri = isTauriApp()

    // 构建飞书授权URL，移动端需要在redirect_uri中添加platform参数
    const loginUrl = new URL(FEISHU_AUTH_URL)
    loginUrl.searchParams.set('app_id', appId)

    // 移动端：在redirect_uri中添加platform=mobile参数
    const finalRedirectUri = mobile ? `${redirectUri}?platform=mobile` : redirectUri
    loginUrl.searchParams.set('redirect_uri', finalRedirectUri)
    loginUrl.searchParams.set('scope', scope)
    loginUrl.searchParams.set('state', state)
    const urlStr = loginUrl.toString()

    // 桌面 Tauri：使用弹窗 WebView
    // 移动端 Tauri：使用系统浏览器（避免 WebView 无法处理 deep link）
    // Web：直接在当前窗口跳转
    if (isTauri && !mobile) {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const oauthWindow = new WebviewWindow('oauth', {
        url: urlStr,
        title: '飞书登录',
        width: 520,
        height: 680,
      })
      oauthWindow.once('tauri://error', (e) => console.warn('[Canmou] OAuth window error:', e))
    } else if (isTauri && mobile) {
      // 移动端 Tauri：使用系统浏览器打开 OAuth，这样 deep link 回调才能正常工作
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(urlStr)
    } else {
      // Web 环境：直接跳转
      window.location.href = urlStr
    }
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
