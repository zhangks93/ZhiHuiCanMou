import { useState, useRef } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Settings as SettingsIcon, Bot, Check, Trash2, Globe, Plus } from 'lucide-react'
import { loadLLMConfig, saveLLMConfig, clearLLMConfig, loadProviderSettings, DEFAULT_URLS, DEFAULT_MODELS, type LLMConfig, type ProviderSettings } from '@/lib/llmConfig'
import { MODULE_NAV_CONFIG } from '@/config/modules'
import { getEnabledModules, saveEnabledModules } from '@/lib/moduleStorage'

export function Settings() {
  const [initialConfig] = useState(() => loadLLMConfig())
  const [provider, setProvider] = useState<LLMConfig['provider']>(initialConfig?.provider ?? 'openai')
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl ?? DEFAULT_URLS[initialConfig?.provider ?? 'openai'])
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '')
  const [model, setModel] = useState(initialConfig?.model ?? DEFAULT_MODELS[initialConfig?.provider ?? 'openai'])
  const [tavilyApiKey, setTavilyApiKey] = useState(initialConfig?.tavilyApiKey ?? '')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Module management state
  const [enabledModules, setEnabledModules] = useState<string[]>(() => getEnabledModules())

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
    saveLLMConfig({ provider, apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), model: model.trim(), tavilyApiKey: tavilyApiKey.trim() || undefined })
    setFeedback({ type: 'success', msg: '已保存' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleClear = () => {
    clearLLMConfig()
    setProvider('openai')
    setApiUrl(DEFAULT_URLS.openai)
    setApiKey('')
    setModel(DEFAULT_MODELS.openai)
    setTavilyApiKey('')
    setFeedback({ type: 'success', msg: '已清除' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const toggleModule = (moduleId: string) => {
    const newEnabled = enabledModules.includes(moduleId)
      ? enabledModules.filter(id => id !== moduleId)
      : [...enabledModules, moduleId]

    setEnabledModules(newEnabled)
    saveEnabledModules(newEnabled)

    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('modules-updated'))

    setFeedback({ type: 'success', msg: '模块配置已更新' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const allModules = Object.entries(MODULE_NAV_CONFIG).map(([id, config]) => ({
    id,
    label: config.label,
    section: config.section,
  }))

  return (
    <>
      <PageTitle breadcrumb="/ 设置" title="设置" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-800">预警阈值配置</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">业务板块</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">黄色预警</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">红色预警</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 text-gray-800">后勤集团 / 三中心 / 三区域</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 80%</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 70%</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 text-gray-800">自有学校食堂</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 80%</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 72%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-4">※ 阈值调整请联系系统管理员</p>
        </div>

        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
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
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-800">AI 分析配置</h3>
          </div>

          <div className="space-y-4 max-w-lg">
            {/* Provider */}
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">模型提供商</label>
              <div className="flex gap-4">
                {(['openai', 'claude'] as const).map((p) => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="llm-provider"
                      className="radio radio-sm radio-primary"
                      checked={provider === p}
                      onChange={() => handleProviderChange(p)}
                    />
                    {p === 'openai' ? 'OpenAI' : 'Claude'}
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
              <p className="text-xs text-gray-400 mt-1">如 gpt-4o、claude-sonnet-4-20250514 等</p>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">API Key</label>
              <input
                type="password"
                className="input input-bordered input-sm w-full font-mono text-xs"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
              />
            </div>

            {/* Tavily Search API Key */}
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Globe size={13} />
                  Tavily Search API Key
                  <span className="text-xs text-gray-400 font-normal">（可选，用于联网搜索）</span>
                </span>
              </label>
              <input
                type="password"
                className="input input-bordered input-sm w-full font-mono text-xs"
                value={tavilyApiKey}
                onChange={(e) => setTavilyApiKey(e.target.value)}
                placeholder="tvly-..."
              />
              <p className="text-xs text-gray-400 mt-1">
                免费申请：tavily.com（1000次/月）
              </p>
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
