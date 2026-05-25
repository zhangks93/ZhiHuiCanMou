import { useEffect, useState } from 'react'
import { createAuthError, getAuthError, type AuthError } from '@/shared/lib/auth-errors'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { AppBrandMark } from '@/shared/ui/AppBrandMark'
import {
  completeBrowserOAuth,
  completeDesktopOAuth,
  getAuthRuntime,
  parseAuthCallbackParams,
  validateCallbackState,
  waitForAuthenticatedUser,
} from '@/features/auth/services/authCallbackService'

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
    setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
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
      const { accessToken, refreshToken, state, debugDetails } = parseAuthCallbackParams(window.location)
      debugDetails.forEach(addDebugInfo)

      const stateError = validateCallbackState(state)
      if (stateError) {
        addDebugInfo('错误: State 验证失败 (可能的 CSRF 攻击)')
        if (mounted) {
          setStatus('error')
          setErrorMsg(stateError.message)
          setAuthError(stateError)
        }
        return
      } else if (!state) {
        addDebugInfo('警告: 未收到 state 参数')
      } else {
        addDebugInfo('State 验证成功')
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

      const { isTauri } = getAuthRuntime()

      addDebugInfo(`环境: ${isTauri ? 'Tauri' : 'Web'}, 桌面端`)

      if (isTauri) {
        try {
          addDebugInfo('桌面模式: 发送事件到主窗口')
          await completeDesktopOAuth(accessToken, refreshToken)

          if (mounted) {
            setStatus('success')
            setProgress(100)
          }

          addDebugInfo('事件发送成功，准备关闭窗口')
        } catch (e) {
          const nextErrorMsg = getErrorMessage(e, '认证失败')
          addDebugInfo(`桌面模式错误: ${nextErrorMsg}`)
          if (mounted) {
            setStatus('error')
            setErrorMsg(nextErrorMsg)
          }
        }
      } else {
        addDebugInfo('Web 模式: 直接设置会话')
        const result = await completeBrowserOAuth({
          accessToken,
          refreshToken,
          onRetry: (attempt, error) => {
            const errorMessage = getErrorMessage(error, '认证失败')
            addDebugInfo(`重试第 ${attempt} 次: ${errorMessage}`)
            if (mounted) {
              setStatus('retrying')
              setRetryAttempt(attempt)
              setProgress(50 + (attempt * 10))
            }
          },
        })

        if (result.authError) {
          addDebugInfo(`setSession 失败 (${result.attempts} 次尝试): ${result.authError.message}`)
          if (mounted) {
            setStatus('error')
            setErrorMsg(result.authError.message)
            setAuthError(result.authError)
          }
          return
        }

        addDebugInfo(`会话设置成功 (${result.attempts} 次尝试)`)

        addDebugInfo('等待认证状态更新...')
        const authState = await waitForAuthenticatedUser()
        const authStateReady = authState.ready
        if (authStateReady) {
          addDebugInfo(`认证状态已更新 (${authState.checkCount} 次检查)`)
        } else {
          for (let check = 1; check <= authState.checkCount; check += 1) {
            addDebugInfo(`等待认证状态... (${check}/${authState.checkCount})`)
          }
        }

        if (!authStateReady) {
          addDebugInfo('警告: 认证状态未及时更新，但仍将跳转')
        }

        if (mounted) {
          setStatus('success')
          setProgress(100)
        }

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

      <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
        <div className="absolute -right-20 -top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(95,127,188,0.14),transparent_65%)] animate-pulse-glow" />
        <div className="absolute -bottom-16 -left-16 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.09),transparent_65%)] animate-pulse-glow [animation-delay:1.2s]" />
      </div>

      <div className="w-full max-w-[360px] animate-slide-up">
        <div className="mb-8 flex justify-center">
          <AppBrandMark
            size="md"
            ringTone={isInProgress ? 'accent' : status === 'success' ? 'success' : 'error'}
            animated={isInProgress}
          />
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white/60 px-6 py-8 text-center shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(95,127,188,0.24)] to-transparent" />

          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center">
            {isInProgress && (
              <div className="relative">
                <div className="h-10 w-10 animate-spin rounded-full border-[2.5px] border-[rgba(148,163,184,0.16)] border-t-[var(--color-accent)]" />
                <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-[2.5px] border-transparent border-b-[rgba(95,127,188,0.20)]" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
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

          <h2 className="text-title font-semibold text-[var(--color-text-strong)]">
            {authError?.title || cfg.title}
          </h2>
          <p className="mt-1.5 text-body text-[var(--color-text-muted)]">
            {authError?.message || message}
          </p>

          {isInProgress && (
            <div className="mx-auto mt-6 h-[3px] w-full max-w-[200px] overflow-hidden rounded-full bg-[rgba(15,23,42,0.04)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[rgba(142,169,213,0.75)] transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {status === 'success' && (
            <div className="mx-auto mt-6 h-[3px] w-full max-w-[200px] overflow-hidden rounded-full bg-[rgba(15,159,110,0.08)]">
              <div className="h-full w-full rounded-full bg-[var(--color-success)]" />
            </div>
          )}

          {status === 'error' && (
            <div className="mt-5 text-left">
              {authError && (
                <div className="rounded-2xl border border-[rgba(220,38,38,0.10)] bg-[rgba(220,38,38,0.03)] px-4 py-3 text-body leading-6 text-[var(--color-text-muted)]">
                  {authError.suggestion}
                </div>
              )}
              {!authError && errorMsg && (
                <div className="rounded-2xl border border-[rgba(220,38,38,0.10)] bg-[rgba(220,38,38,0.03)] px-4 py-3 text-body leading-6 text-[var(--color-error)]">
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

        {debugInfo.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white/40 p-4 backdrop-blur-lg">
            <div className="mb-2 text-caption font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Debug
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-caption leading-5 text-[var(--color-text-muted)]">
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
