import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { isTauriRuntime } from '@/shared/lib/tauri'

const AI_LAST_EE_HOST = 'ai.last.ee'
const AI_LAST_EE_PROXY_PREFIX = '/__proxy__/ai-last-ee'

function resolveDevProxyUrl(rawUrl: string): string {
  if (!import.meta.env.DEV || isTauriRuntime()) return rawUrl

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return rawUrl
  }

  if (parsed.hostname !== AI_LAST_EE_HOST) return rawUrl

  return `${AI_LAST_EE_PROXY_PREFIX}${parsed.pathname}${parsed.search}`
}

export async function appFetch(input: string, init?: RequestInit): Promise<Response> {
  const requestUrl = resolveDevProxyUrl(input)
  if (isTauriRuntime()) {
    return tauriFetch(requestUrl, init)
  }
  return fetch(requestUrl, init)
}

