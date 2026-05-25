import { Check, Trash2 } from 'lucide-react'
import { DEFAULT_URLS, DEFAULT_MODELS, type LLMConfig } from '@/shared/lib/llmConfig'
import type { SettingsFeedback } from '../hooks/useLlmSettings'

type ProviderOption = {
  id: LLMConfig['provider']
  name: string
  hint: string
  keyPlaceholder: string
}

export type LlmConfigPanelProps = {
  provider: LLMConfig['provider']
  apiUrl: string
  apiKey: string
  model: string
  setApiUrl: (v: string) => void
  setApiKey: (v: string) => void
  setModel: (v: string) => void
  handleProviderChange: (p: LLMConfig['provider']) => void
  handleSave: () => void | Promise<void>
  handleClear: () => void | Promise<void>
  providerOptions: readonly ProviderOption[]
  feedback: SettingsFeedback
}

export function LlmConfigPanel({
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
  providerOptions,
  feedback,
}: LlmConfigPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">

        <div className="mt-5 max-w-3xl space-y-5">
          <div>
            <label className="mb-2 block text-body text-gray-600">模型供应商</label>
            <div className="flex flex-wrap gap-2">
              {providerOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleProviderChange(option.id)}
                  className={`rounded-full border px-4 py-2 text-body font-medium transition-colors ${
                    provider === option.id
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary'
                  }`}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const activeProvider = providerOptions.find((option) => option.id === provider) ?? providerOptions[0]

            return (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="llm-api-url" className="mb-1.5 block text-body text-slate-700">
                      API URL
                    </label>
                    <input
                      id="llm-api-url"
                      type="text"
                      className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder={DEFAULT_URLS[provider]}
                    />
                    <p className="mt-1.5 text-caption text-slate-500">
                      默认地址：{DEFAULT_URLS[provider]}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="llm-model" className="mb-1.5 block text-body text-slate-700">
                      模型名称
                    </label>
                    <input
                      id="llm-model"
                      type="text"
                      className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={DEFAULT_MODELS[provider]}
                    />
                    <p className="mt-1.5 text-caption text-slate-500">{activeProvider.hint}</p>
                  </div>

                  <div>
                    <label htmlFor="llm-api-key" className="mb-1.5 block text-body text-slate-700">
                      API Key
                    </label>
                    <input
                      id="llm-api-key"
                      type="password"
                      className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={activeProvider.keyPlaceholder}
                    />
                    <p className="mt-1.5 text-caption text-slate-500">
                      默认模型：{DEFAULT_MODELS[provider]}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    <Check size={14} /> 保存
                  </button>
                  <button
                    onClick={handleClear}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-body font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    <Trash2 size={14} /> 清除
                  </button>
                  {feedback && (
                    <span className={`text-body ${feedback.type === 'success' ? 'text-success-700' : 'text-error-700'}`}>
                      {feedback.msg}
                    </span>
                  )}
                </div>
              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}
