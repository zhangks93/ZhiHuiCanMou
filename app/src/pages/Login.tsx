import { useMemo, useState } from 'react'
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
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (msg: string) => {
    console.log('[Canmou Login]', msg)
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const handleFeishuLogin = async () => {
    if (!canLogin || isLoading) return

    setIsLoading(true)
    setDebugInfo([])

    try {
      const mobile = isMobile()
      const isTauri = isTauriApp()

      addDebugInfo(`环境检测: ${isTauri ? 'Tauri' : 'Web'}, ${mobile ? '移动端' : '桌面端'}`)

      // 构建飞书授权URL，移动端需要在redirect_uri中添加platform参数
      const loginUrl = new URL(FEISHU_AUTH_URL)
      loginUrl.searchParams.set('app_id', appId)

      // 移动端：在redirect_uri中添加platform=mobile参数
      const finalRedirectUri = mobile ? `${redirectUri}?platform=mobile` : redirectUri
      loginUrl.searchParams.set('redirect_uri', finalRedirectUri)
      loginUrl.searchParams.set('scope', scope)
      loginUrl.searchParams.set('state', state)
      const urlStr = loginUrl.toString()

      addDebugInfo(`授权URL: ${urlStr.substring(0, 100)}...`)

      // 桌面 Tauri：使用弹窗 WebView
      // 移动端 Tauri：使用系统浏览器（避免 WebView 无法处理 deep link）
      // Web：直接在当前窗口跳转
      if (isTauri && !mobile) {
        addDebugInfo('使用桌面弹窗模式')
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        const oauthWindow = new WebviewWindow('oauth', {
          url: urlStr,
          title: '飞书登录',
          width: 520,
          height: 680,
        })
        oauthWindow.once('tauri://error', (e) => {
          addDebugInfo(`OAuth窗口错误: ${JSON.stringify(e)}`)
          setIsLoading(false)
        })
        oauthWindow.once('tauri://destroyed', () => {
          addDebugInfo('OAuth窗口已关闭')
          setIsLoading(false)
        })
      } else if (isTauri && mobile) {
        // 移动端 Tauri：使用系统浏览器打开 OAuth，这样 deep link 回调才能正常工作
        addDebugInfo('使用系统浏览器打开授权页面')
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(urlStr)
        addDebugInfo('已打开系统浏览器，等待回调...')
        // 移动端打开浏览器后，保持加载状态，等待 deep link 回调

        // 设置超时，如果30秒后还没有回调，提示用户
        setTimeout(() => {
          if (isLoading) {
            addDebugInfo('等待超时，请检查是否完成授权')
            setIsLoading(false)
          }
        }, 30000)
      } else {
        // Web 环境：直接跳转
        addDebugInfo('Web环境，直接跳转')
        window.location.href = urlStr
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addDebugInfo(`登录错误: ${errorMsg}`)
      console.error('[Canmou] Login error:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
          position: relative;
          overflow: hidden;
        }

        .login-container::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 80%;
          height: 150%;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.08) 0%, transparent 70%);
          animation: float 20s ease-in-out infinite;
        }

        .login-container::after {
          content: '';
          position: absolute;
          bottom: -30%;
          left: -10%;
          width: 60%;
          height: 100%;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%);
          animation: float 25s ease-in-out infinite reverse;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(1.1); }
        }

        .login-card {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 3rem 2.5rem;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1;
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

        .login-logo {
          width: 72px;
          height: 72px;
          margin: 0 auto 2rem;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Crimson Text', serif;
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
          box-shadow:
            0 8px 24px rgba(251, 191, 36, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset;
          animation: logoAppear 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s backwards;
        }

        @keyframes logoAppear {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-10deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        .login-title {
          font-family: 'Crimson Text', serif;
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          text-align: center;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
          animation: fadeIn 0.6s ease-out 0.3s backwards;
        }

        .login-subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: #64748b;
          text-align: center;
          margin-bottom: 2.5rem;
          animation: fadeIn 0.6s ease-out 0.4s backwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .login-button {
          width: 100%;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border: none;
          border-radius: 16px;
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow:
            0 4px 16px rgba(15, 23, 42, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          animation: fadeIn 0.6s ease-out 0.5s backwards;
          position: relative;
          overflow: hidden;
        }

        .login-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transition: left 0.5s;
        }

        .login-button:hover::before {
          left: 100%;
        }

        .login-button:hover {
          transform: translateY(-2px);
          box-shadow:
            0 8px 24px rgba(15, 23, 42, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.15) inset;
        }

        .login-button:active {
          transform: translateY(0);
        }

        .login-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .login-button:disabled:hover {
          transform: none;
          box-shadow:
            0 4px 16px rgba(15, 23, 42, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }

        .feishu-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Crimson Text', serif;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-footer {
          margin-top: 2rem;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          line-height: 1.6;
          color: #94a3b8;
          text-align: center;
          animation: fadeIn 0.6s ease-out 0.6s backwards;
        }

        .error-message {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #dc2626;
          text-align: center;
          animation: shake 0.4s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }

        .status-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }

        .debug-info {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.05);
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 12px;
          max-height: 200px;
          overflow-y: auto;
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
          .login-card {
            padding: 2.5rem 1.5rem;
            max-width: 100%;
          }

          .login-title {
            font-size: 24px;
          }

          .login-logo {
            width: 64px;
            height: 64px;
            font-size: 28px;
          }
        }
      `}</style>

      <div className="login-card">
        <div className="login-logo">智</div>

        <h1 className="login-title">智汇参谋</h1>
        <p className="login-subtitle">
          <span className="status-indicator"></span>
          使用飞书账号安全登录
        </p>

        <button
          type="button"
          onClick={handleFeishuLogin}
          disabled={!canLogin || isLoading}
          className="login-button"
        >
          {isLoading ? (
            <>
              <div className="loading-spinner"></div>
              <span>正在跳转...</span>
            </>
          ) : (
            <>
              <div className="feishu-icon">飞</div>
              <span>使用飞书登录</span>
            </>
          )}
        </button>

        {!canLogin && (
          <div className="error-message">
            未配置飞书登录，请设置环境变量
          </div>
        )}

        <p className="login-footer">
          登录即表示你已阅读并同意本系统的相关条款
        </p>

        {debugInfo.length > 0 && (
          <div className="debug-info">
            <div className="debug-title">调试信息</div>
            {debugInfo.map((info, idx) => (
              <div key={idx} className="debug-line">{info}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

