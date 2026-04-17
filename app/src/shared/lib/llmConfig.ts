import {
  DEFAULT_MODELS,
  DEFAULT_URLS,
  getSettingsSnapshot,
  saveStoredLLMSettings,
  subscribeSettingsSnapshot,
  type LLMConfig,
  type ProviderSettings,
} from '@/shared/lib/settingsStore'

export { DEFAULT_MODELS, DEFAULT_URLS }
export type { LLMConfig, LLMProvider, ProviderSettings } from '@/shared/lib/settingsStore'

/** Load active provider's config */
export function loadLLMConfig(): LLMConfig | null {
  const store = getSettingsSnapshot().llm
  if (!store) return null
  const settings = store.providers[store.provider]
  if (!settings) return null
  const apiKey = settings.apiKey
  if (!apiKey) return null
  return {
    provider: store.provider,
    apiUrl: settings.apiUrl,
    apiKey,
    model: settings.model,
  }
}

/** Load a specific provider's saved settings (used by Settings page) */
export function loadProviderSettings(provider: LLMConfig['provider']): ProviderSettings | null {
  const store = getSettingsSnapshot().llm
  const settings = store?.providers[provider]
  if (!settings) return null

  return {
    ...settings,
  }
}

/** Save config, preserving other provider's settings */
export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  const store = getSettingsSnapshot().llm || { provider: config.provider, providers: {} }
  store.provider = config.provider
  store.providers[config.provider] = {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model,
  }
  await saveStoredLLMSettings(store)
}

export async function clearLLMConfig(): Promise<void> {
  await saveStoredLLMSettings(null)
}

export function subscribeLLMConfig(listener: (config: LLMConfig | null) => void): () => void {
  return subscribeSettingsSnapshot(() => {
    listener(loadLLMConfig())
  })
}
