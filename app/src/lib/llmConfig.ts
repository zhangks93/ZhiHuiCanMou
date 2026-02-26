export interface LLMConfig {
  provider: 'openai' | 'claude'
  apiUrl: string
  apiKey: string
  model: string
}

const STORAGE_KEY = 'llm_config'

export const DEFAULT_URLS: Record<LLMConfig['provider'], string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
}

export const DEFAULT_MODELS: Record<LLMConfig['provider'], string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
}

export function loadLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LLMConfig
    if (!parsed.provider || !parsed.apiKey) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearLLMConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
