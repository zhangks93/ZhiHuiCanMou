import { useState } from 'react'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { logger } from '@/shared/lib/logger'
import { isTauriRuntime } from '@/shared/lib/tauri'

export function DeepLinkTest() {
  const [testUrl, setTestUrl] = useState('canmou://auth-callback#access_token=test123&refresh_token=test456')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `${timestamp}: ${msg}`])
    logger.debug(`DeepLinkTest: ${msg}`)
  }

  const testDeepLink = async () => {
    addLog('开始测试 deep link')
    addLog(`测试URL: ${testUrl}`)

    try {
      const isTauri = isTauriRuntime()

      if (isTauri) {
        addLog('Tauri 环境检测成功')

        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(testUrl)
        addLog('已调用 openUrl')
      } else {
        addLog('非 Tauri 环境，尝试直接跳转')
        window.location.href = testUrl
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error, 'Deep link 测试失败')
      addLog(`错误: ${errorMsg}`)
    }
  }

  const testNavigation = () => {
    addLog('测试直接导航到 auth-callback')
    window.location.hash = '/auth-callback#access_token=test123&refresh_token=test456'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '2rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        fontFamily: 'var(--font-family-body)',
      }}
    >
      <h1 style={{ marginBottom: '2rem' }}>Deep Link 测试工具</h1>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
        }}
      >
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 'var(--font-size-body)' }}>
          测试 URL:
        </label>
        <input
          type="text"
          value={testUrl}
          onChange={(event) => setTestUrl(event.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: 'var(--font-size-body)',
            fontFamily: 'var(--font-family-body)',
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#0f172a',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => void testDeepLink()}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: '#0f172a',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          测试 Deep Link
        </button>

        <button
          onClick={testNavigation}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          测试直接导航
        </button>
      </div>

      <div
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '1.5rem',
          borderRadius: '12px',
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginBottom: '1rem', fontSize: 'var(--font-size-body)', color: '#94a3b8' }}>日志输出</h3>
        {logs.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 'var(--font-size-body)' }}>暂无日志</p>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-caption)',
                padding: '4px 0',
                color: '#e2e8f0',
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
