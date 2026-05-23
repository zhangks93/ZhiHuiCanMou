import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, Copy, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { buildSettingsHref } from '@/app/config/constants'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { loadLLMConfig, saveLLMConfig, clearLLMConfig, loadProviderSettings, DEFAULT_URLS, DEFAULT_MODELS, type LLMConfig, type ProviderSettings } from '@/shared/lib/llmConfig'
import { loadThresholdSettings, saveThresholdSettings, resetThresholdSettings, DEFAULT_THRESHOLDS, type ThresholdSettings } from '@/shared/lib/thresholdConfig'
import {
  beginFeishuAuth,
  completeFeishuAuth,
  getFeishuAuthStatus,
  getFeishuCliHealth,
  initFeishuConfig,
  removeFeishuConfig,
  type FeishuCliHealth,
  type FeishuCliResponse,
} from '@/shared/lib/feishu/feishuClient'

const PROVIDER_OPTIONS = [
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

export function Settings() {
  const [searchParams] = useSearchParams()
  const [initialConfig] = useState(() => loadLLMConfig())
  const [provider, setProvider] = useState<LLMConfig['provider']>(initialConfig?.provider ?? 'openai')
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl ?? DEFAULT_URLS[initialConfig?.provider ?? 'openai'])
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '')
  const [model, setModel] = useState(initialConfig?.model ?? DEFAULT_MODELS[initialConfig?.provider ?? 'openai'])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const [feishuHealth, setFeishuHealth] = useState<FeishuCliHealth | null>(null)
  const [feishuAuthStatus, setFeishuAuthStatus] = useState<FeishuCliResponse | null>(null)
  const [feishuStatusError, setFeishuStatusError] = useState<string | null>(null)
  const [feishuStatusLoading, setFeishuStatusLoading] = useState(false)
  const [feishuAppId, setFeishuAppId] = useState('')
  const [feishuAppSecret, setFeishuAppSecret] = useState('')
  const [feishuSetupLoading, setFeishuSetupLoading] = useState(false)
  const [feishuAuthLoading, setFeishuAuthLoading] = useState(false)
  const [feishuAuthPayload, setFeishuAuthPayload] = useState<Record<string, unknown> | null>(null)

  // Threshold settings state
  const [thresholds, setThresholds] = useState<ThresholdSettings>(() => loadThresholdSettings())
  const [isEditingThresholds, setIsEditingThresholds] = useState(false)
  const [tempThresholds, setTempThresholds] = useState<ThresholdSettings>(thresholds)

  // Cache unsaved form values per provider so switching doesn't lose edits
  const providerCache = useRef<Partial<Record<LLMConfig['provider'], ProviderSettings>>>({})

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const showToast = (message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }
    setToast(message)
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2200)
  }

  const handleProviderChange = (p: LLMConfig['provider']) => {
    // Cache current provider's form values
    providerCache.current[provider] = { apiUrl, apiKey, model }
    setProvider(p)
    // Restore from cache first, then localStorage, then defaults
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

  const handleSaveThresholds = async () => {
    // 验证阈值合法性
    if (tempThresholds.default.yellowThreshold <= tempThresholds.default.redThreshold) {
      setFeedback({ type: 'error', msg: '黄色预警阈值必须大于红色预警阈值' })
      return
    }

    try {
      await saveThresholdSettings(tempThresholds)
    } catch {
      setFeedback({ type: 'error', msg: '预警阈值保存失败' })
      return
    }
    setThresholds(tempThresholds)
    setIsEditingThresholds(false)

    setFeedback({ type: 'success', msg: '预警阈值已保存' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleResetThresholds = async () => {
    try {
      await resetThresholdSettings()
    } catch {
      setFeedback({ type: 'error', msg: '恢复默认失败' })
      return
    }
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

  const loadFeishuStatus = async () => {
    setFeishuStatusLoading(true)
    setFeishuStatusError(null)
    setFeishuAuthStatus(null)
    try {
      const health = await getFeishuCliHealth()
      setFeishuHealth(health)
      if (health.installed) {
        try {
          setFeishuAuthStatus(await getFeishuAuthStatus())
        } catch {
          setFeishuAuthStatus(null)
        }
      }
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '飞书 CLI 状态检查失败'))
    } finally {
      setFeishuStatusLoading(false)
    }
  }

  const parseFeishuPayload = (response: FeishuCliResponse) => {
    const parsed = response.parsed_json
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  }

  const pickNestedString = (value: unknown, keys: string[]): string => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const record = value as Record<string, unknown>
    for (const key of keys) {
      const direct = record[key]
      if (typeof direct === 'string' && direct.trim()) return direct.trim()
    }
    for (const nested of Object.values(record)) {
      const found = pickNestedString(nested, keys)
      if (found) return found
    }
    return ''
  }

  const extractFeishuUrl = (payload: Record<string, unknown> | null) => {
    return pickNestedString(payload, ['verification_uri_complete', 'verification_url', 'verification_uri', 'console_url'])
  }

  const extractDeviceCode = (payload: Record<string, unknown> | null) => {
    return pickNestedString(payload, ['device_code'])
  }

  const handleFeishuConfigInit = async () => {
    if (!feishuAppId.trim() || !feishuAppSecret.trim()) {
      setFeishuStatusError('请输入 App ID 和 App Secret')
      return
    }
    setFeishuSetupLoading(true)
    setFeishuStatusError(null)
    try {
      await initFeishuConfig({
        appId: feishuAppId.trim(),
        appSecret: feishuAppSecret.trim(),
        brand: 'feishu',
      })
      setFeishuAppSecret('')
      showToast('飞书应用配置已保存')
      await loadFeishuStatus()
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '飞书应用配置失败'))
    } finally {
      setFeishuSetupLoading(false)
    }
  }

  const handleFeishuAuthBegin = async () => {
    setFeishuAuthLoading(true)
    setFeishuStatusError(null)
    try {
      const response = await beginFeishuAuth()
      setFeishuAuthPayload(parseFeishuPayload(response))
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '飞书授权启动失败'))
    } finally {
      setFeishuAuthLoading(false)
    }
  }

  const handleFeishuAuthComplete = async () => {
    const deviceCode = extractDeviceCode(feishuAuthPayload)
    if (!deviceCode) {
      setFeishuStatusError('缺少 device_code，请重新发起授权')
      return
    }
    setFeishuAuthLoading(true)
    setFeishuStatusError(null)
    try {
      await completeFeishuAuth({ device_code: deviceCode })
      setFeishuAuthPayload(null)
      showToast('飞书授权已完成')
      await loadFeishuStatus()
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '飞书授权确认失败'))
    } finally {
      setFeishuAuthLoading(false)
    }
  }

  const handleFeishuConfigRemove = async () => {
    if (!window.confirm('确认清除本机飞书 CLI 配置和授权状态？')) return
    setFeishuSetupLoading(true)
    setFeishuStatusError(null)
    try {
      await removeFeishuConfig()
      setFeishuAuthPayload(null)
      showToast('飞书配置已清除')
      await loadFeishuStatus()
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '清除飞书配置失败'))
    } finally {
      setFeishuSetupLoading(false)
    }
  }

  const handleCopyFeishuUrl = async () => {
    const url = extractFeishuUrl(feishuAuthPayload)
    if (!url) return
    await navigator.clipboard.writeText(url)
    showToast('授权链接已复制')
  }

  useEffect(() => {
    if (searchParams.get('tab') === 'feishu-cli') {
      void loadFeishuStatus()
    }
  }, [searchParams])

  const requestedTab = searchParams.get('tab')
  const activeTab = requestedTab === 'ai-model' || requestedTab === 'feishu-cli' ? requestedTab : 'thresholds'
  const tabItems = [
    { key: 'thresholds', label: '预警阈值', to: buildSettingsHref('thresholds'), active: activeTab === 'thresholds' },
    { key: 'ai-model', label: 'AI 模型配置', to: buildSettingsHref('ai-model'), active: activeTab === 'ai-model' },
    { key: 'feishu-cli', label: '飞书 CLI', to: buildSettingsHref('feishu-cli'), active: activeTab === 'feishu-cli' },
  ]

  return (
    <TabbedPageShell tabs={tabItems}>
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-[70] sm:right-6">
          <div className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-emerald-100 bg-white/96 px-4 py-3 text-body text-emerald-700 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl animate-fade-in">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={16} />
            </span>
            <span className="font-medium">{toast}</span>
          </div>
        </div>
      )}
      {activeTab === 'thresholds' ? (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} strokeWidth={1.5} className="text-gray-600" />
                <h3 className="font-medium text-gray-800">经营数据预警阈值</h3>
              </div>
              {!isEditingThresholds && (
                <button
                  onClick={handleStartEdit}
                  className="text-caption px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                >
                  编辑
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-body text-gray-600">完成率预警阈值</div>
                  <div className="flex items-center gap-4">
                    {isEditingThresholds ? (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-caption text-gray-600 whitespace-nowrap">黄色预警</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={(tempThresholds.default.yellowThreshold * 100).toFixed(0)}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                              setTempThresholds((prev: ThresholdSettings) => ({
                                ...prev,
                                default: { ...prev.default, yellowThreshold: val / 100 }
                              }))
                            }}
                            className="input input-bordered input-sm w-16 text-center text-body"
                          />
                          <span className="text-body text-gray-600">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-caption text-gray-600 whitespace-nowrap">红色预警</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={(tempThresholds.default.redThreshold * 100).toFixed(0)}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                              setTempThresholds((prev: ThresholdSettings) => ({
                                ...prev,
                                default: { ...prev.default, redThreshold: val / 100 }
                              }))
                            }}
                            className="input input-bordered input-sm w-16 text-center text-body"
                          />
                          <span className="text-body text-gray-600">%</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-caption text-gray-500">黄色</span>
                          <span className="px-2.5 py-1 bg-warning-100 text-warning-700 rounded text-body font-medium">
                            &lt; {(thresholds.default.yellowThreshold * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-caption text-gray-500">红色</span>
                          <span className="px-2.5 py-1 bg-error-100 text-error-700 rounded text-body font-medium">
                            &lt; {(thresholds.default.redThreshold * 100).toFixed(0)}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isEditingThresholds && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveThresholds}
                    className="px-4 py-1.5 text-body font-medium rounded-lg bg-primary text-white hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Check size={14} /> 保存
                  </button>
                  <button
                    onClick={handleResetThresholds}
                    className="px-4 py-1.5 text-body font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> 恢复默认
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-1.5 text-body font-medium rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    取消
                  </button>
                  {feedback && (
                    <span className={`text-body ${feedback.type === 'success' ? 'text-success-700' : 'text-error-700'}`}>
                      {feedback.msg}
                    </span>
                  )}
                </div>
              )}

              <div className="text-caption text-gray-500 leading-relaxed pt-2 border-t border-gray-200">
                <p className="mb-1">预警规则：</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>完成率 ≥ 黄色阈值：<span className="text-success-600 font-medium">正常</span></li>
                  <li>红色阈值 ≤ 完成率 &lt; 黄色阈值：<span className="text-warning-600 font-medium">黄色预警</span></li>
                  <li>完成率 &lt; 红色阈值：<span className="text-error-600 font-medium">红色预警</span></li>
                </ul>
                <p className="mt-2">
                  成本/费用/人数/成本率类指标按“越低越好”折算；利润等目标为负数时，按“亏损收窄或转正更优”折算。
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'feishu-cli' ? (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-gray-800">飞书连接</h3>
                <p className="mt-1 text-caption text-gray-500">
                  桌面端已随应用打包 lark-cli，可在这里完成应用配置和用户授权。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadFeishuStatus()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2 text-body font-medium text-gray-700 transition-colors hover:bg-gray-200"
                disabled={feishuStatusLoading}
              >
                <RefreshCw size={14} className={feishuStatusLoading ? 'animate-spin' : ''} />
                刷新状态
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-caption text-slate-500">打包状态</div>
                    <div className={feishuHealth?.installed ? 'mt-1 text-body font-medium text-success-700' : 'mt-1 text-body font-medium text-warning-700'}>
                      {feishuHealth ? (feishuHealth.installed ? '已内置 lark-cli' : '未检测到内置 lark-cli') : '尚未检查'}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-slate-500">配置状态</div>
                    <div className={feishuHealth?.configured ? 'mt-1 text-body font-medium text-success-700' : 'mt-1 text-body font-medium text-warning-700'}>
                      {feishuHealth ? (feishuHealth.configured ? '已配置应用' : '未配置应用') : '尚未检查'}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-slate-500">授权状态</div>
                    <div className={feishuHealth?.authenticated ? 'mt-1 text-body font-medium text-success-700' : 'mt-1 text-body font-medium text-warning-700'}>
                      {feishuHealth ? (feishuHealth.authenticated ? '已完成用户授权' : '未完成用户授权') : '尚未检查'}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-slate-500">版本</div>
                    <div className="mt-1 break-all font-mono text-caption text-slate-700">
                      {feishuHealth?.version || '-'}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-caption text-slate-500">路径</div>
                    <div className="mt-1 break-all font-mono text-caption text-slate-700">
                      {feishuHealth?.path || '-'}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-caption text-slate-500">登录状态</div>
                    <pre className="mt-1 max-h-56 overflow-auto rounded-xl bg-white p-3 text-caption text-slate-700">
                      {feishuAuthStatus
                        ? JSON.stringify(feishuAuthStatus.parsed_json ?? feishuAuthStatus.stdout, null, 2)
                        : '未获取登录状态'}
                    </pre>
                  </div>
                </div>
              </div>

              {(feishuStatusError || feishuHealth?.error) && (
                <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-body text-warning-800">
                  {feishuStatusError || feishuHealth?.error}
                </div>
              )}

              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="text-body font-medium text-slate-800">1. 配置飞书应用</div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="feishu-app-id" className="mb-1.5 block text-caption text-slate-600">
                      App ID
                    </label>
                    <input
                      id="feishu-app-id"
                      type="text"
                      value={feishuAppId}
                      onChange={(event) => setFeishuAppId(event.target.value)}
                      className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                      placeholder="cli_a..."
                    />
                  </div>
                  <div>
                    <label htmlFor="feishu-app-secret" className="mb-1.5 block text-caption text-slate-600">
                      App Secret
                    </label>
                    <input
                      id="feishu-app-secret"
                      type="password"
                      value={feishuAppSecret}
                      onChange={(event) => setFeishuAppSecret(event.target.value)}
                      className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                      placeholder="仅通过 stdin 写入 lark-cli"
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleFeishuConfigInit()}
                    disabled={feishuSetupLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {feishuSetupLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    保存应用配置
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFeishuConfigRemove()}
                    disabled={feishuSetupLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-body font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                    清除配置
                  </button>
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="text-body font-medium text-slate-800">2. 完成用户授权</div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleFeishuAuthBegin()}
                    disabled={feishuAuthLoading || !feishuHealth?.configured}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {feishuAuthLoading ? <RefreshCw size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                    生成授权链接
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFeishuAuthComplete()}
                    disabled={feishuAuthLoading || !extractDeviceCode(feishuAuthPayload)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-body font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60"
                  >
                    <Check size={14} />
                    我已完成授权
                  </button>
                </div>

                {extractFeishuUrl(feishuAuthPayload) && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-caption text-slate-500">授权链接</div>
                    <div className="break-all rounded-lg bg-white px-3 py-2 font-mono text-caption text-slate-700">
                      {extractFeishuUrl(feishuAuthPayload)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => window.open(extractFeishuUrl(feishuAuthPayload), '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-caption font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <ExternalLink size={13} />
                        打开
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyFeishuUrl()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-caption font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <Copy size={13} />
                        复制
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">

            <div className="mt-5 max-w-3xl space-y-5">
              <div>
                <label className="mb-2 block text-body text-gray-600">模型供应商</label>
                <div className="flex flex-wrap gap-2">
                  {PROVIDER_OPTIONS.map((option) => (
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
                const activeProvider = PROVIDER_OPTIONS.find((option) => option.id === provider) ?? PROVIDER_OPTIONS[0]

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
      )}
    </TabbedPageShell>
  )
}
