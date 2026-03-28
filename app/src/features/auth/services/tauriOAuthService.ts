import { setOAuthSessionTokens } from './authSessionService'

export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

export async function registerOAuthCompleteListener(handlers: {
  onStart: () => void
  onFinish: () => void
  onError: (error: unknown) => void
}) {
  const { listen } = await import('@tauri-apps/api/event')

  return listen<{ access_token?: string; refresh_token?: string }>('auth:oauth-complete', async (event) => {
    const { access_token, refresh_token } = event.payload ?? {}
    if (!access_token || !refresh_token) return

    handlers.onStart()
    try {
      console.log('[Canmou] Received OAuth tokens, setting session...')
      await setOAuthSessionTokens(access_token, refresh_token)
      console.log('[Canmou] Session set successfully')
    } catch (error) {
      handlers.onError(error)
    } finally {
      handlers.onFinish()
    }
  })
}

export async function emitOAuthComplete(accessToken: string, refreshToken: string) {
  const { emit } = await import('@tauri-apps/api/event')
  await emit('auth:oauth-complete', { access_token: accessToken, refresh_token: refreshToken })
}

export async function closeCurrentOAuthWindow() {
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const windowRef = getCurrentWebviewWindow()
  if (windowRef) {
    await windowRef.close()
  }
}
