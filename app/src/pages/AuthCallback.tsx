import { useEffect, useState } from 'react'

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

export function AuthCallback() {
  const [status, setStatus] = useState<'parsing' | 'success' | 'error'>('parsing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      // 尝试从多个来源获取 token
      const hash = window.location.hash
      const search = window.location.search
      const fullUrl = window.location.href

      // 合并所有可能的参数来源
      const hashParams = parseHashParams(hash)
      const urlParams = parseUrlParams(fullUrl)
      const searchParams = parseUrlParams(search)
      const params = { ...urlParams, ...searchParams, ...hashParams }

      console.log('AuthCallback - Full URL:', fullUrl)
      console.log('AuthCallback - Parsed params:', params)

      const accessToken = params.access_token
      const refreshToken = params.refresh_token

      if (!accessToken || !refreshToken) {
        if (mounted) {
          setStatus('error')
          setErrorMsg('未找到认证信息，请重试登录')
          console.error('Missing tokens. Hash:', hash, 'Search:', search, 'Params:', params)
        }
        return
      }

      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
      const isMobile =
        typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

      if (isTauri && !isMobile) {
        // 桌面 Tauri：通过事件通知主窗口并关闭弹窗
        try {
          const { emit } = await import('@tauri-apps/api/event')
          emit('auth:oauth-complete', { access_token: accessToken, refresh_token: refreshToken })
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
          const win = getCurrentWebviewWindow()
          if (win) win.close()
          if (mounted) setStatus('success')
        } catch (e) {
          if (mounted) {
            setStatus('error')
            setErrorMsg(e instanceof Error ? e.message : '登录失败')
          }
        }
      } else {
        // Web / 移动端：在当前窗口直接 setSession 并返回首页
        const { supabase } = await import('@/lib/supabase')
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (error) {
          console.error('setSession error:', error)
          throw error
        }
        if (mounted) setStatus('success')
        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          window.location.hash = '/'
        }, 1000)
      }
    }
    run().catch((e) => {
      if (mounted) {
        setStatus('error')
        setErrorMsg(e instanceof Error ? e.message : '登录失败')
        console.error('AuthCallback error:', e)
      }
    })
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center">
        {status === 'parsing' && (
          <p className="text-[var(--color-text-muted)]">正在完成登录...</p>
        )}
        {status === 'success' && (
          <p className="text-accent">登录成功，窗口即将关闭</p>
        )}
        {status === 'error' && (
          <p className="text-warning-700">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
