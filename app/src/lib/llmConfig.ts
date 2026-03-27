export interface LLMConfig {
  provider: 'openai' | 'claude' | 'deepseek' | 'kimi' | 'openrouter'
  apiUrl: string
  apiKey: string
  model: string
  tavilyApiKey?: string
}

export interface ProviderSettings {
  apiUrl: string
  apiKey: string
  model: string
}

interface LLMConfigStore {
  provider: LLMConfig['provider']
  tavilyApiKey?: string
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

/** Read raw store from localStorage, migrating old flat format if needed */
function loadStore(): LLMConfigStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // New format already has 'providers' key
    if (parsed.providers) return parsed as LLMConfigStore
    // Old flat format → migrate
    if (parsed.provider && parsed.apiKey) {
      const store: LLMConfigStore = {
        provider: parsed.provider,
        tavilyApiKey: parsed.tavilyApiKey,
        providers: {
          [parsed.provider]: {
            apiUrl: parsed.apiUrl,
            apiKey: parsed.apiKey,
            model: parsed.model,
          },
        },
      }
      // Persist migrated format
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
      return store
    }
    return null
  } catch {
    return null
  }
}

/** Load active provider's config (used by AgentChat / BizData) */
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
    tavilyApiKey: store.tavilyApiKey,
  }
}

/** Load a specific provider's saved settings (used by Settings page) */
export function loadProviderSettings(provider: LLMConfig['provider']): ProviderSettings | null {
  const store = loadStore()
  return store?.providers[provider] ?? null
}

/** Load tavilyApiKey from store */
export function loadTavilyApiKey(): string | undefined {
  const store = loadStore()
  return store?.tavilyApiKey
}

/** Save config, preserving other provider's settings */
export function saveLLMConfig(config: LLMConfig): void {
  const store = loadStore() || { provider: config.provider, providers: {} }
  store.provider = config.provider
  store.tavilyApiKey = config.tavilyApiKey
  store.providers[config.provider] = {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function clearLLMConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
