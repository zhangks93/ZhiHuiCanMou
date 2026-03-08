import { useState } from 'react'

export function DeepLinkTest() {
  const [testUrl, setTestUrl] = useState('canmou://auth-callback#access_token=test123&refresh_token=test456')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `${timestamp}: ${msg}`])
    console.log('[DeepLinkTest]', msg)
  }

  const testDeepLink = async () => {
    addLog('开始测试 deep link')
    addLog(`测试URL: ${testUrl}`)

    try {
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

      if (isTauri) {
        addLog('Tauri 环境检测成功')

        // 尝试使用 opener 插件打开 URL
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(testUrl)
        addLog('已调用 openUrl')
      } else {
        addLog('非 Tauri 环境，尝试直接跳转')
        window.location.href = testUrl
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog(`错误: ${errorMsg}`)
    }
  }

  const testNavigation = () => {
    addLog('测试直接导航到 auth-callback')
    window.location.hash = '/auth-callback#access_token=test123&refresh_token=test456'
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white',
      fontFamily: 'Inter, sans-serif'
    }}>
      <h1 style={{ marginBottom: '2rem' }}>Deep Link 测试工具</h1>

      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '1.5rem'
      }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px' }}>
          测试 URL:
        </label>
        <input
          type="text"
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontFamily: 'monospace',
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#0f172a'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={testDeepLink}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: '#0f172a',
            fontWeight: 600,
            cursor: 'pointer'
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
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          测试直接导航
        </button>

        <button
          onClick={clearLogs}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            background: 'transparent',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          清除日志
        </button>
      </div>

      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '1.5rem',
        borderRadius: '12px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '14px', color: '#94a3b8' }}>日志输出</h3>
        {logs.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>暂无日志</p>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '4px 0',
                color: '#e2e8f0'
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '12px',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        <h3 style={{ marginBottom: '1rem', color: '#60a5fa' }}>使用说明</h3>
        <ul style={{ paddingLeft: '1.5rem', color: '#cbd5e1' }}>
          <li>在移动端，点击"测试 Deep Link"应该能唤起应用</li>
          <li>在桌面端，可以测试直接导航功能</li>
          <li>修改测试 URL 来测试不同的参数组合</li>
          <li>查看日志输出了解执行过程</li>
        </ul>
      </div>
    </div>
  )
}
