import { createBrowserStore } from '@/shared/storage/createBrowserStore'

export interface LLMConfig {
  provider: 'openai' | 'claude' | 'deepseek' | 'kimi' | 'openrouter'
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

export const DEFAULT_URLS: Record<LLMConfig['provider'], string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  deepseek: 'https://api.deepseek.com/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

export const DEFAULT_MODELS: Record<LLMConfig['provider'], string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
  deepseek: 'deepseek-chat',
  kimi: 'moonshot-v1-8k',
  openrouter: 'openai/gpt-4o-mini',
}

function deserializeStore(raw: string): LLMConfigStore | null {
  const parsed = JSON.parse(raw)
  if (parsed?.providers) return parsed as LLMConfigStore

  if (parsed?.provider && parsed?.apiKey) {
    return {
      provider: parsed.provider,
      providers: {
        [parsed.provider]: {
          apiUrl: parsed.apiUrl,
          apiKey: parsed.apiKey,
          model: parsed.model,
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
