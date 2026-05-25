import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  loadLLMConfig,
  saveLLMConfig,
  clearLLMConfig,
  loadProviderSettings,
  DEFAULT_URLS,
  DEFAULT_MODELS,
  type LLMConfig,
  type ProviderSettings,
} from '@/shared/lib/llmConfig'
import { getErrorMessage } from '@/shared/lib/errorMessage'

export const PROVIDER_OPTIONS = [
  {
    id: 'openai',
    name: 'OpenAI',
    hint: '如 gpt-4o、gpt-4o-mini 等',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'claude',
    name: 'Claude',
    hint: '如 claude-sonnet-4-20250514、claude-opus-4-20250514 等',
    keyPlaceholder: 'sk-ant-...',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    hint: '如 deepseek-chat、deepseek-reasoner 等',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    hint: '如 moonshot-v1-8k、moonshot-v1-32k、moonshot-v1-128k 等',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    hint: '如 MiniMax-M2.5 等',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'glm',
    name: 'GLM',
    hint: '如 glm-4.7、glm-4-plus 等',
    keyPlaceholder: 'Bearer Token',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    hint: '如 google/gemini-2.5-pro-preview、anthropic/claude-sonnet-4 等',
    keyPlaceholder: 'sk-or-...',
  },
] as const satisfies Array<{
  id: LLMConfig['provider']
  name: string
  hint: string
  keyPlaceholder: string
}>

export type SettingsFeedback = { type: 'success' | 'error'; msg: string } | null

export function useLlmSettings(
  setFeedback: Dispatch<SetStateAction<SettingsFeedback>>,
  showToast: (message: string) => void,
) {
  const [initialConfig] = useState(() => loadLLMConfig())
  const [provider, setProvider] = useState<LLMConfig['provider']>(initialConfig?.provider ?? 'openai')
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl ?? DEFAULT_URLS[initialConfig?.provider ?? 'openai'])
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '')
  const [model, setModel] = useState(initialConfig?.model ?? DEFAULT_MODELS[initialConfig?.provider ?? 'openai'])

  const providerCache = useRef<Partial<Record<LLMConfig['provider'], ProviderSettings>>>({})

  const handleProviderChange = (p: LLMConfig['provider']) => {
    providerCache.current[provider] = { apiUrl, apiKey, model }
    setProvider(p)
    const cached = providerCache.current[p]
    const saved = cached || loadProviderSettings(p)
    if (saved) {
      setApiUrl(saved.apiUrl)
      setApiKey(saved.apiKey ?? '')
      setModel(saved.model)
    } else {
      setApiUrl(DEFAULT_URLS[p])
      setApiKey('')
      setModel(DEFAULT_MODELS[p])
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setFeedback({ type: 'error', msg: '请输入 API Key' })
      return
    }
    try {
      await saveLLMConfig({ provider, apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), model: model.trim() })
    } catch (error) {
      setFeedback({ type: 'error', msg: getErrorMessage(error, '配置保存失败') })
      return
    }

    setFeedback(null)
    showToast('配置保存成功')
  }

  const handleClear = async () => {
    try {
      await clearLLMConfig()
    } catch {
      setFeedback({ type: 'error', msg: '清除失败' })
      return
    }
    setProvider('openai')
    setApiUrl(DEFAULT_URLS.openai)
    setApiKey('')
    setModel(DEFAULT_MODELS.openai)
    setFeedback({ type: 'success', msg: '已清除' })
    setTimeout(() => setFeedback(null), 2000)
  }

  return {
    provider,
    apiUrl,
    apiKey,
    model,
    setApiUrl,
    setApiKey,
    setModel,
    handleProviderChange,
    handleSave,
    handleClear,
    providerOptions: PROVIDER_OPTIONS,
  }
}
