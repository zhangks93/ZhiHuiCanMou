export function isTauriRuntime() {
  if (typeof window === 'undefined') return false

  const tauriWindow = window as Window & {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }

  return Boolean(tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__)
}

export async function invokeTauri<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error('日程功能仅支持本地客户端，请在 Tauri 应用中使用。')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}
