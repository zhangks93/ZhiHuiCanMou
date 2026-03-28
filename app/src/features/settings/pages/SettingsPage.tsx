import { useState, useRef } from 'react'
import { Settings as SettingsIcon, Bot, Check, Trash2, Plus, AlertTriangle } from 'lucide-react'
import { loadLLMConfig, saveLLMConfig, clearLLMConfig, loadProviderSettings, DEFAULT_URLS, DEFAULT_MODELS, type LLMConfig, type ProviderSettings } from '@/shared/lib/llmConfig'
import { MODULE_NAV_CONFIG } from '@/app/config/modules'
import { getEnabledModules, saveEnabledModules } from '@/shared/lib/moduleStorage'
import { loadThresholdSettings, saveThresholdSettings, resetThresholdSettings, DEFAULT_THRESHOLDS, type ThresholdSettings } from '@/shared/lib/thresholdConfig'

export function Settings() {
  const [initialConfig] = useState(() => loadLLMConfig())
  const [provider, setProvider] = useState<LLMConfig['provider']>(initialConfig?.provider ?? 'openai')
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl ?? DEFAULT_URLS[initialConfig?.provider ?? 'openai'])
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '')
  const [model, setModel] = useState(initialConfig?.model ?? DEFAULT_MODELS[initialConfig?.provider ?? 'openai'])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Module management state
  const [enabledModules, setEnabledModules] = useState<string[]>(() => getEnabledModules())

  // Threshold settings state
  const [thresholds, setThresholds] = useState<ThresholdSettings>(() => loadThresholdSettings())
  const [isEditingThresholds, setIsEditingThresholds] = useState(false)
  const [tempThresholds, setTempThresholds] = useState<ThresholdSettings>(thresholds)

  // Cache unsaved form values per provider so switching doesn't lose edits
  const providerCache = useRef<Partial<Record<LLMConfig['provider'], ProviderSettings>>>({})

  const handleProviderChange = (p: LLMConfig['provider']) => {
    // Cache current provider's form values
    providerCache.current[provider] = { apiUrl, apiKey, model }
    setProvider(p)
    // Restore from cache first, then localStorage, then defaults
    const cached = providerCache.current[p]
    const saved = cached || loadProviderSettings(p)
    if (saved) {
      setApiUrl(saved.apiUrl)
      setApiKey(saved.apiKey)
      setModel(saved.model)
    } else {
      setApiUrl(DEFAULT_URLS[p])
      setApiKey('')
      setModel(DEFAULT_MODELS[p])
    }
  }

  const handleSave = () => {
    if (!apiKey.trim()) {
      setFeedback({ type: 'error', msg: '请输入 API Key' })
      return
    }
    saveLLMConfig({ provider, apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), model: model.trim() })

    setFeedback({ type: 'success', msg: '已保存' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleClear = () => {
    clearLLMConfig()
    setProvider('openai')
    setApiUrl(DEFAULT_URLS.openai)
    setApiKey('')
    setModel(DEFAULT_MODELS.openai)
    setFeedback({ type: 'success', msg: '已清除' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const toggleModule = (moduleId: string) => {
    const newEnabled = enabledModules.includes(moduleId)
      ? enabledModules.filter(id => id !== moduleId)
      : [...enabledModules, moduleId]

    setEnabledModules(newEnabled)
    saveEnabledModules(newEnabled)

    setFeedback({ type: 'success', msg: '模块配置已更新' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleSaveThresholds = () => {
    // 验证阈值合法性
    if (tempThresholds.default.yellowThreshold <= tempThresholds.default.redThreshold) {
      setFeedback({ type: 'error', msg: '黄色预警阈值必须大于红色预警阈值' })
      return
    }

    saveThresholdSettings(tempThresholds)
    setThresholds(tempThresholds)
    setIsEditingThresholds(false)

    setFeedback({ type: 'success', msg: '预警阈值已保存' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleResetThresholds = () => {
    resetThresholdSettings()
    setThresholds(DEFAULT_THRESHOLDS)
    setTempThresholds(DEFAULT_THRESHOLDS)
    setIsEditingThresholds(false)
    setFeedback({ type: 'success', msg: '已恢复默认阈值' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleStartEdit = () => {
    setTempThresholds(thresholds)
    setIsEditingThresholds(true)
  }

  const handleCancelEdit = () => {
    setTempThresholds(thresholds)
    setIsEditingThresholds(false)
  }

  const allModules = Object.entries(MODULE_NAV_CONFIG).map(([id, config]) => ({
    id,
    label: config.label,
    section: config.section,
  }))

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} strokeWidth={1.5} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">经营数据预警阈值</h3>
            </div>
            {!isEditingThresholds && (
              <button
                onClick={handleStartEdit}
                className="text-xs px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                编辑
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* 阈值设置 */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-600">完成率预警阈值</div>
                <div className="flex items-center gap-4">
                  {isEditingThresholds ? (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 whitespace-nowrap">黄色预警</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={(tempThresholds.default.yellowThreshold * 100).toFixed(0)}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                            setTempThresholds(prev => ({
                              ...prev,
                              default: { ...prev.default, yellowThreshold: val / 100 }
                            }))
                          }}
                          className="input input-bordered input-sm w-16 text-center text-sm"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 whitespace-nowrap">红色预警</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={(tempThresholds.default.redThreshold * 100).toFixed(0)}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                            setTempThresholds(prev => ({
                              ...prev,
                              default: { ...prev.default, redThreshold: val / 100 }
                            }))
                          }}
                          className="input input-bordered input-sm w-16 text-center text-sm"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">黄色</span>
                        <span className="px-2.5 py-1 bg-warning-100 text-warning-700 rounded text-sm font-medium">
                          &lt; {(thresholds.default.yellowThreshold * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">红色</span>
                        <span className="px-2.5 py-1 bg-error-100 text-error-700 rounded text-sm font-medium">
                          &lt; {(thresholds.default.redThreshold * 100).toFixed(0)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            {isEditingThresholds && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveThresholds}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check size={14} /> 保存
                </button>
                <button
                  onClick={handleResetThresholds}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> 恢复默认
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
              </div>
            )}

            <div className="text-xs text-gray-500 leading-relaxed pt-2 border-t border-gray-200">
              <p className="mb-1">预警规则：</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>完成率 ≥ 黄色阈值：<span className="text-success-600 font-medium">正常</span></li>
                <li>红色阈值 ≤ 完成率 &lt; 黄色阈值：<span className="text-warning-600 font-medium">黄色预警</span></li>
                <li>完成率 &lt; 红色阈值：<span className="text-error-600 font-medium">红色预警</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SettingsIcon size={18} strokeWidth={1.5} className="text-gray-600" />
              <h3 className="font-medium text-gray-800">功能模块管理</h3>
            </div>
            <div className="text-xs text-gray-500">
              已启用 <span className="font-semibold text-primary">{enabledModules.length}</span> / {allModules.length}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {allModules.map((module) => {
              const isEnabled = enabledModules.includes(module.id)
              return (
                <button
                  key={module.id}
                  onClick={() => toggleModule(module.id)}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all text-left ${
                    isEnabled
                      ? 'bg-primary/5 border-primary/30 hover:bg-primary/10'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{module.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {module.section === 'workbench' && '工作台'}
                      {module.section === 'data-center' && '数据中心'}
                      {module.section === 'business' && '业务管理'}
                      {module.section === 'tools' && '工具与分析'}
                    </div>
                  </div>
                  <div className={`ml-2 p-1 rounded ${
                    isEnabled
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isEnabled ? <Check size={14} /> : <Plus size={14} />}
                  </div>
                </button>
              )
            })}
          </div>

          <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
            点击模块卡片即可启用或禁用，配置会立即生效
          </p>
        </div>

        {/* AI Analysis Config */}
        <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)] lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-800">AI 模型配置</h3>
          </div>

          <div className="space-y-4 max-w-lg">
            {/* Provider */}
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">模型提供商</label>
              <div className="flex flex-wrap gap-4">
                {(['openai', 'claude', 'deepseek', 'kimi', 'openrouter'] as const).map((p) => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="llm-provider"
                      className="radio radio-sm radio-primary"
                      checked={provider === p}
                      onChange={() => handleProviderChange(p)}
                    />
                    {p === 'openai' && 'OpenAI'}
                    {p === 'claude' && 'Claude'}
                    {p === 'deepseek' && 'DeepSeek'}
                    {p === 'kimi' && 'Kimi'}
                    {p === 'openrouter' && 'OpenRouter'}
                  </label>
                ))}
              </div>
            </div>

            {/* API URL */}
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">API URL</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full font-mono text-xs"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder={DEFAULT_URLS[provider]}
              />
              <p className="text-xs text-gray-400 mt-1">如使用代理，可修改为自定义地址</p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">模型名称</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full font-mono text-xs"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={DEFAULT_MODELS[provider]}
              />
              <p className="text-xs text-gray-400 mt-1">
                {provider === 'openai' && '如 gpt-4o、gpt-4o-mini 等'}
                {provider === 'claude' && '如 claude-sonnet-4-20250514、claude-opus-4-20250514 等'}
                {provider === 'deepseek' && '如 deepseek-chat、deepseek-reasoner 等'}
                {provider === 'kimi' && '如 moonshot-v1-8k、moonshot-v1-32k、moonshot-v1-128k 等'}
                {provider === 'openrouter' && '如 openai/gpt-4o-mini、anthropic/claude-sonnet-4 等'}
              </p>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">API Key</label>
              <input
                type="password"
                className="input input-bordered input-sm w-full font-mono text-xs"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                provider === 'openai' ? 'sk-...' :
                provider === 'claude' ? 'sk-ant-...' :
                provider === 'deepseek' ? 'sk-...' :
                provider === 'kimi' ? 'sk-...' :
                'sk-or-...'
              }
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check size={14} /> 保存
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} /> 清除
              </button>
              {feedback && (
                <span className={`text-sm ${feedback.type === 'success' ? 'text-success-700' : 'text-error-700'}`}>
                  {feedback.msg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
