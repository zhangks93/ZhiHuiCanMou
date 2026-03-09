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
      const isMobile =
        typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

      addDebugInfo(`环境: ${isTauri ? 'Tauri' : 'Web'}, ${isMobile ? '移动端' : '桌面端'}`)

      if (isTauri && !isMobile) {
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
            addDebugInfo(`重试第 ${attempt} 次: ${error?.message || String(error)}`)
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

        if (mounted) {
          setStatus('success')
          setProgress(100)
        }

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          addDebugInfo('跳转到首页')
          window.location.hash = '/'
        }, 1500)
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

  return (
    <div className="auth-callback-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:wght@600;700&family=Inter:wght@400;500;600&display=swap');

        .auth-callback-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
          position: relative;
          overflow: hidden;
        }

        .auth-callback-container::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 80%;
          height: 150%;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.08) 0%, transparent 70%);
          animation: float 20s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(1.1); }
        }

        .auth-callback-card {
          position: relative;
          width: 100%;
          max-width: 400px;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 3rem 2rem;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1;
          text-align: center;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .status-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          animation: iconAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes iconAppear {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .status-icon.parsing,
        .status-icon.authenticating {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4);
        }

        .status-icon.success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
        }

        .status-icon.error {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(15, 23, 42, 0.2);
          border-top-color: #0f172a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .status-title {
          font-family: 'Crimson Text', serif;
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.5rem;
          animation: fadeIn 0.6s ease-out 0.2s backwards;
        }

        .status-message {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: #64748b;
          margin-bottom: 2rem;
          animation: fadeIn 0.6s ease-out 0.3s backwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(15, 23, 42, 0.1);
          border-radius: 3px;
          overflow: hidden;
          animation: fadeIn 0.6s ease-out 0.4s backwards;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 3px;
          transition: width 0.3s ease-out;
          box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
        }

        .progress-bar.success {
          background: linear-gradient(90deg, #10b981 0%, #059669 100%);
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .error-details {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #dc2626;
          animation: shake 0.4s ease-in-out;
        }

        .error-suggestion {
          margin-bottom: 0.75rem;
          line-height: 1.5;
        }

        .retry-button {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border: none;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .retry-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
        }

        .retry-button:active {
          transform: translateY(0);
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }

        .checkmark {
          width: 40px;
          height: 40px;
          stroke: #0f172a;
          stroke-width: 3;
          stroke-linecap: round;
          fill: none;
          animation: checkmark 0.6s ease-out;
        }

        @keyframes checkmark {
          0% { stroke-dashoffset: 100; }
          100% { stroke-dashoffset: 0; }
        }

        .checkmark path {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: checkmark 0.6s ease-out forwards;
        }

        .debug-info {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.05);
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 12px;
          max-height: 200px;
          overflow-y: auto;
          text-align: left;
        }

        .debug-title {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 0.5rem;
        }

        .debug-line {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #475569;
          line-height: 1.6;
          padding: 2px 0;
        }

        @media (max-width: 640px) {
          .auth-callback-card {
            padding: 2.5rem 1.5rem;
          }

          .status-title {
            font-size: 20px;
          }

          .status-icon {
            width: 64px;
            height: 64px;
            font-size: 32px;
          }
        }
      `}</style>

      <div className="auth-callback-card">
        {status === 'parsing' && (
          <>
            <div className="status-icon parsing">
              <div className="spinner"></div>
            </div>
            <h2 className="status-title">正在验证</h2>
            <p className="status-message">正在解析认证信息...</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          </>
        )}

        {status === 'authenticating' && (
          <>
            <div className="status-icon authenticating">
              <div className="spinner"></div>
            </div>
            <h2 className="status-title">登录中</h2>
            <p className="status-message">正在完成身份认证...</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          </>
        )}

        {status === 'retrying' && (
          <>
            <div className="status-icon authenticating">
              <div className="spinner"></div>
            </div>
            <h2 className="status-title">重试中</h2>
            <p className="status-message">正在重试连接 (第 {retryAttempt} 次)...</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="status-icon success">
              <svg className="checkmark" viewBox="0 0 52 52">
                <path d="M14 27l8 8 16-16" />
              </svg>
            </div>
            <h2 className="status-title">登录成功</h2>
            <p className="status-message">正在跳转到应用...</p>
            <div className="progress-bar-container">
              <div className="progress-bar success" style={{ width: '100%' }}></div>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="status-icon error">
              <span>✕</span>
            </div>
            <h2 className="status-title">{authError?.title || '登录失败'}</h2>
            <p className="status-message">{authError?.message || '认证过程出现问题'}</p>
            {authError && (
              <div className="error-details">
                <div className="error-suggestion">{authError.suggestion}</div>
                {authError.retryable && (
                  <button
                    className="retry-button"
                    onClick={() => window.location.reload()}
                  >
                    重试登录
                  </button>
                )}
              </div>
            )}
            {!authError && errorMsg && (
              <div className="error-details">{errorMsg}</div>
            )}
            {debugInfo.length > 0 && (
              <div className="debug-info">
                <div className="debug-title">调试信息</div>
                {debugInfo.map((info, idx) => (
                  <div key={idx} className="debug-line">{info}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
