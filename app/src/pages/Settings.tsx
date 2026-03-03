import { useState, useRef } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Settings as SettingsIcon, Bot, Check, Trash2, Globe } from 'lucide-react'
import { loadLLMConfig, saveLLMConfig, clearLLMConfig, loadProviderSettings, DEFAULT_URLS, DEFAULT_MODELS, type LLMConfig, type ProviderSettings } from '@/lib/llmConfig'

const modules = [
  '日程提醒', '常用数据', '经营数据', '商机管理',
  '竞对档案', '出差管理', '考勤管理', '系统链接', '智能分析',
]

export function Settings() {
  const [initialConfig] = useState(() => loadLLMConfig())
  const [provider, setProvider] = useState<LLMConfig['provider']>(initialConfig?.provider ?? 'openai')
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl ?? DEFAULT_URLS[initialConfig?.provider ?? 'openai'])
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '')
  const [model, setModel] = useState(initialConfig?.model ?? DEFAULT_MODELS[initialConfig?.provider ?? 'openai'])
  const [tavilyApiKey, setTavilyApiKey] = useState(initialConfig?.tavilyApiKey ?? '')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

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
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-800">功能模块管理</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {modules.map((m) => (
              <span key={m} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                {m}
              </span>
            ))}
          </div>
          <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-700 transition-colors shadow-sm">
            + 动态添加模块
          </button>
          <p className="text-xs text-gray-600 mt-2">功能开发中，请联系IT部门</p>
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
