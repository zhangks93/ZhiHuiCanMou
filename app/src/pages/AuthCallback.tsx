import { useEffect, useState } from 'react'
import { validateAuthState, clearAuthState } from '@/lib/auth-storage'
import { retrySetSession } from '@/lib/auth-retry'
import { createAuthError, getAuthError, type AuthError } from '@/lib/auth-errors'

/**
 * OAuth 回调页：解析 Supabase magic link 重定向中的 token，通过事件传给主窗口
 * 主窗口负责调用 setSession；此页仅在 Tauri 内嵌 WebView 的 OAuth 弹窗中加载
 *
 * 支持的 URL 格式：
 * - Web: /#/auth-callback#access_token=xxx&refresh_token=xxx
 * - Mobile deep link: canmou://auth-callback#access_token=xxx&refresh_token=xxx
 */
function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  // 支持 #access_token=xxx、#/auth-callback#access_token=xxx 等格式
  const paramPart = fragment.includes('#') ? (fragment.split('#').pop() ?? '') : fragment
  new URLSearchParams(paramPart).forEach((v, k) => { params[k] = v })
  return params
}

function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {}
  try {
    // 处理 deep link URL: canmou://auth-callback#access_token=xxx
    if (url.includes('#')) {
      const hashPart = url.split('#').pop() ?? ''
      new URLSearchParams(hashPart).forEach((v, k) => { params[k] = v })
    }
    // 处理 query string: ?access_token=xxx
    if (url.includes('?')) {
      const queryPart = url.split('?').pop()?.split('#')[0] ?? ''
      new URLSearchParams(queryPart).forEach((v, k) => { params[k] = v })
    }
  } catch (e) {
    console.error('Failed to parse URL params:', e)
  }
  return params
}

type AuthStatus = 'parsing' | 'authenticating' | 'retrying' | 'success' | 'error'

const STATUS_CONFIG: Record<AuthStatus, { title: string; message: string | ((n: number) => string) }> = {
  parsing: {
    title: '正在验证',
    message: '正在解析认证信息...',
  },
  authenticating: {
    title: '登录中',
    message: '正在完成身份认证...',
  },
  retrying: {
    title: '重试中',
    message: (n: number) => `正在重试连接 (第 ${n} 次)...`,
  },
  success: {
    title: '登录成功',
    message: '正在跳转到应用...',
  },
  error: {
    title: '登录失败',
    message: '认证过程出现问题',
  },
}

export function AuthCallback() {
  const [status, setStatus] = useState<AuthStatus>('parsing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [authError, setAuthError] = useState<AuthError | null>(null)
  const [progress, setProgress] = useState(0)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (msg: string) => {
    console.log('[Canmou AuthCallback]', msg)
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    let mounted = true
    const progressInterval: number | undefined = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + 10
      })
    }, 200)

    const run = async () => {
      // 尝试从多个来源获取 token
      const hash = window.location.hash
      const search = window.location.search
      const fullUrl = window.location.href

      addDebugInfo(`完整URL: ${fullUrl}`)
      addDebugInfo(`Hash: ${hash}`)
      addDebugInfo(`Search: ${search}`)

      // 合并所有可能的参数来源
      const hashParams = parseHashParams(hash)
      const urlParams = parseUrlParams(fullUrl)
      const searchParams = parseUrlParams(search)
      const params = { ...urlParams, ...searchParams, ...hashParams }

      addDebugInfo(`解析参数: ${JSON.stringify(params)}`)

      const accessToken = params.access_token
      const refreshToken = params.refresh_token
      const state = params.state

      // Validate CSRF state parameter
      if (state) {
        const isValidState = validateAuthState(state)
        if (!isValidState) {
          addDebugInfo('错误: State 验证失败 (可能的 CSRF 攻击)')
          const error = getAuthError('STATE_VALIDATION_FAILED')
          if (mounted) {
            setStatus('error')
            setErrorMsg(error.message)
            setAuthError(error)
          }
          return
        }
        addDebugInfo('State 验证成功')
      } else {
        addDebugInfo('警告: 未收到 state 参数')
        // Clear any stored state to prevent reuse
        clearAuthState()
      }

      if (!accessToken || !refreshToken) {
        const error = getAuthError('MISSING_TOKENS')
        if (mounted) {
          setStatus('error')
          setErrorMsg(error.message)
          setAuthError(error)
          addDebugInfo('错误: 缺少 access_token 或 refresh_token')
        }
        return
      }

      addDebugInfo('Token 解析成功')

      if (mounted) {
        setStatus('authenticating')
        setProgress(50)
      }

      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
      const isMobileDevice =
        typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

      addDebugInfo(`环境: ${isTauri ? 'Tauri' : 'Web'}, ${isMobileDevice ? '移动端' : '桌面端'}`)

      if (isTauri && !isMobileDevice) {
        // 桌面 Tauri：通过事件通知主窗口并关闭弹窗
        try {
          addDebugInfo('桌面模式: 发送事件到主窗口')
          const { emit } = await import('@tauri-apps/api/event')
          emit('auth:oauth-complete', { access_token: accessToken, refresh_token: refreshToken })

          if (mounted) {
            setStatus('success')
            setProgress(100)
          }

          addDebugInfo('事件发送成功，准备关闭窗口')

          // 延迟关闭，让用户看到成功状态
          setTimeout(async () => {
            const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
            const win = getCurrentWebviewWindow()
            if (win) win.close()
          }, 1500)
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          addDebugInfo(`桌面模式错误: ${errorMsg}`)
          if (mounted) {
            setStatus('error')
            setErrorMsg(errorMsg)
          }
        }
      } else {
        // Web / 移动端：在当前窗口直接 setSession 并返回首页
        addDebugInfo('移动端/Web模式: 直接设置会话')
        const { supabase } = await import('@/lib/supabase')

        // Use retry mechanism for setSession
        const result = await retrySetSession(
          () => supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
          (attempt, error) => {
            const errorMessage = error instanceof Error ? error.message : String(error)
            addDebugInfo(`重试第 ${attempt} 次: ${errorMessage}`)
            if (mounted) {
              setStatus('retrying')
              setRetryAttempt(attempt)
              setProgress(50 + (attempt * 10))
            }
          }
        )

        if (!result.success) {
          const error = result.error as { code?: string; message?: string } | undefined
          const authErr = error?.code ? getAuthError(error.code) : createAuthError(error)
          addDebugInfo(`setSession 失败 (${result.attempts} 次尝试): ${error?.message || String(error)}`)
          console.error('setSession error:', error)
          if (mounted) {
            setStatus('error')
            setErrorMsg(authErr.message)
            setAuthError(authErr)
          }
          return
        }

        addDebugInfo(`会话设置成功 (${result.attempts} 次尝试)`)

        // Wait for auth state to propagate by checking getUser()
        addDebugInfo('等待认证状态更新...')
        let authStateReady = false
        for (let i = 0; i < 10; i++) {
          const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser()
          if (currentUser && !getUserError) {
            addDebugInfo(`认证状态已更新 (${i + 1} 次检查)`)
            authStateReady = true
            break
          }
          addDebugInfo(`等待认证状态... (${i + 1}/10)`)
          await new Promise(resolve => setTimeout(resolve, 300))
        }

        if (!authStateReady) {
          addDebugInfo('警告: 认证状态未及时更新，但仍将跳转')
        }

        if (mounted) {
          setStatus('success')
          setProgress(100)
        }

        // 短暂延迟让用户看到成功提示
        setTimeout(() => {
          addDebugInfo('跳转到首页')
          window.location.hash = '/'
        }, 800)
      }
    }

    run().catch((e) => {
      const authErr = createAuthError(e)
      if (mounted) {
        setStatus('error')
        setErrorMsg(authErr.message)
        setAuthError(authErr)
        console.error('AuthCallback error:', e)
      }
    })

    return () => {
      mounted = false
      if (progressInterval) clearInterval(progressInterval)
    }
  }, [])

  const cfg = STATUS_CONFIG[status]
  const isInProgress = status === 'parsing' || status === 'authenticating' || status === 'retrying'
  const message = typeof cfg.message === 'function' ? cfg.message(retryAttempt) : cfg.message

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />

      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
        <div className="absolute -right-20 -top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.12),transparent_65%)] animate-pulse-glow" />
        <div className="absolute -bottom-16 -left-16 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.09),transparent_65%)] animate-pulse-glow [animation-delay:1.2s]" />
      </div>

      <div className="w-full max-w-[360px] animate-slide-up">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-slate-950 text-xs font-semibold tracking-[0.2em] text-white shadow-[0_16px_36px_rgba(15,23,42,0.20)]">
              CM
            </div>
            {/* Status-colored ring */}
            {isInProgress && (
              <div className="absolute -inset-2.5 rounded-[26px] border border-[rgba(37,99,235,0.14)]" style={{ animation: 'orbit 12s linear infinite' }} />
            )}
            {status === 'success' && (
              <div className="absolute -inset-2.5 rounded-[26px] border border-[rgba(15,159,110,0.20)]" />
            )}
            {status === 'error' && (
              <div className="absolute -inset-2.5 rounded-[26px] border border-[rgba(220,38,38,0.14)]" />
            )}
          </div>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white/60 px-6 py-8 text-center shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          {/* Top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(37,99,235,0.28)] to-transparent" />

          {/* Status indicator */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center">
            {isInProgress && (
              <div className="relative">
                <div className="h-10 w-10 animate-spin rounded-full border-[2.5px] border-[rgba(148,163,184,0.16)] border-t-[var(--color-accent)]" />
                <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-[2.5px] border-transparent border-b-[rgba(37,99,235,0.2)]" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              </div>
            )}
            {status === 'success' && (
              <div className="flex h-14 w-14 animate-scale-in items-center justify-center rounded-full bg-[rgba(15,159,110,0.08)] backdrop-blur-sm">
                <svg className="h-7 w-7 text-[var(--color-success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="flex h-14 w-14 animate-scale-in items-center justify-center rounded-full bg-[rgba(220,38,38,0.06)] backdrop-blur-sm">
                <svg className="h-7 w-7 text-[var(--color-error)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">
            {authError?.title || cfg.title}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
            {authError?.message || message}
          </p>

          {/* Progress bar */}
          {isInProgress && (
            <div className="mx-auto mt-6 h-[3px] w-full max-w-[200px] overflow-hidden rounded-full bg-[rgba(15,23,42,0.04)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[rgba(37,99,235,0.6)] transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {status === 'success' && (
            <div className="mx-auto mt-6 h-[3px] w-full max-w-[200px] overflow-hidden rounded-full bg-[rgba(15,159,110,0.08)]">
              <div className="h-full w-full rounded-full bg-[var(--color-success)]" />
            </div>
          )}

          {/* Error details */}
          {status === 'error' && (
            <div className="mt-5 text-left">
              {authError && (
                <div className="rounded-2xl border border-[rgba(220,38,38,0.10)] bg-[rgba(220,38,38,0.03)] px-4 py-3 text-sm leading-6 text-[var(--color-text-muted)]">
                  {authError.suggestion}
                </div>
              )}
              {!authError && errorMsg && (
                <div className="rounded-2xl border border-[rgba(220,38,38,0.10)] bg-[rgba(220,38,38,0.03)] px-4 py-3 text-sm leading-6 text-[var(--color-error)]">
                  {errorMsg}
                </div>
              )}
              <div className="mt-3 flex justify-center">
                {authError?.retryable ? (
                  <button className="btn btn-sm" onClick={() => window.location.reload()}>
                    重试登录
                  </button>
                ) : (
                  <button className="btn btn-sm" onClick={() => { window.location.hash = '/login' }}>
                    返回登录
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Debug info */}
        {debugInfo.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white/40 p-4 backdrop-blur-lg">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Debug
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-[11px] leading-5 text-[var(--color-text-muted)]">
              {debugInfo.map((info, idx) => (
                <div key={idx}>{info}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
