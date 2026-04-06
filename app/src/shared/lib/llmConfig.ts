import { createBrowserStore } from '@/shared/storage/createBrowserStore'

export type LLMProvider = 'openai' | 'claude' | 'deepseek' | 'kimi' | 'minimax' | 'glm' | 'openrouter'

export interface LLMConfig {
  provider: LLMProvider
  apiUrl: string
  apiKey: string
  model: string
}

export interface ProviderSettings {
  apiUrl: string
  apiKey: string
  model: string
}

interface LLMConfigStore {
  provider: LLMConfig['provider']
  providers: Partial<Record<LLMConfig['provider'], ProviderSettings>>
}

const STORAGE_KEY = 'llm_config'

const VALID_PROVIDERS: readonly LLMProvider[] = ['openai', 'claude', 'deepseek', 'kimi', 'minimax', 'glm', 'openrouter']

export const DEFAULT_URLS: Record<LLMConfig['provider'], string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  deepseek: 'https://api.deepseek.com/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
  minimax: 'https://api.minimaxi.com/v1/chat/completions',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

export const DEFAULT_MODELS: Record<LLMConfig['provider'], string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
  deepseek: 'deepseek-chat',
  kimi: 'moonshot-v1-8k',
  minimax: 'MiniMax-M2.5',
  glm: 'glm-4.7',
  openrouter: 'google/gemini-2.5-pro-preview',
}

function isProvider(value: unknown): value is LLMProvider {
  return typeof value === 'string' && VALID_PROVIDERS.includes(value as LLMProvider)
}

function normalizeProvider(value: unknown): LLMProvider {
  return isProvider(value) ? value : 'openai'
}

function deserializeStore(raw: string): LLMConfigStore | null {
  const parsed = JSON.parse(raw)
  if (parsed?.providers && typeof parsed.providers === 'object') {
    const providers: Partial<Record<LLMProvider, ProviderSettings>> = {}

    for (const [rawProvider, rawSettings] of Object.entries(parsed.providers as Record<string, unknown>)) {
      const provider = normalizeProvider(rawProvider)
      if (!rawSettings || typeof rawSettings !== 'object') continue

      const settings = rawSettings as Partial<ProviderSettings>
      providers[provider] = {
        apiUrl: typeof settings.apiUrl === 'string' && settings.apiUrl.trim() ? settings.apiUrl : DEFAULT_URLS[provider],
        apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
        model: typeof settings.model === 'string' && settings.model.trim() ? settings.model : DEFAULT_MODELS[provider],
      }
    }

    return {
      provider: normalizeProvider(parsed.provider),
      providers,
    }
  }

  if (parsed?.provider && parsed?.apiKey) {
    const provider = normalizeProvider(parsed.provider)
    return {
      provider,
      providers: {
        [provider]: {
          apiUrl: typeof parsed.apiUrl === 'string' && parsed.apiUrl.trim() ? parsed.apiUrl : DEFAULT_URLS[provider],
          apiKey: parsed.apiKey,
          model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : DEFAULT_MODELS[provider],
        },
      },
    }
  }

  return null
}

const llmConfigStore = createBrowserStore<LLMConfigStore | null>({
  key: STORAGE_KEY,
  fallback: null,
  deserialize: deserializeStore,
})

/** Read raw store from localStorage, migrating old flat format if needed */
function loadStore(): LLMConfigStore | null {
  return llmConfigStore.get()
}

/** Load active provider's config */
export function loadLLMConfig(): LLMConfig | null {
  const store = loadStore()
  if (!store) return null
  const settings = store.providers[store.provider]
  if (!settings?.apiKey) return null
  return {
    provider: store.provider,
    apiUrl: settings.apiUrl,
    apiKey: settings.apiKey,
    model: settings.model,
  }
}

/** Load a specific provider's saved settings (used by Settings page) */
export function loadProviderSettings(provider: LLMConfig['provider']): ProviderSettings | null {
  const store = loadStore()
  return store?.providers[provider] ?? null
}

/** Save config, preserving other provider's settings */
export function saveLLMConfig(config: LLMConfig): void {
  const store = loadStore() || { provider: config.provider, providers: {} }
  store.provider = config.provider
  store.providers[config.provider] = {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model,
  }
  llmConfigStore.set(store)
}

export function clearLLMConfig(): void {
  llmConfigStore.remove()
}

export function subscribeLLMConfig(listener: (config: LLMConfig | null) => void): () => void {
  return llmConfigStore.subscribe(() => {
    listener(loadLLMConfig())
  })
}
