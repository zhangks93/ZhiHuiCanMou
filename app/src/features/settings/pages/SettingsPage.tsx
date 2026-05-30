import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, Copy, ExternalLink, KeyRound, RefreshCw, Settings2, ShieldCheck, Trash2 } from 'lucide-react'
import { buildSettingsHref } from '@/app/config/constants'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { loadLLMConfig, saveLLMConfig, clearLLMConfig, loadProviderSettings, DEFAULT_URLS, DEFAULT_MODELS, type LLMConfig, type ProviderSettings } from '@/shared/lib/llmConfig'
import { loadThresholdSettings, saveThresholdSettings, resetThresholdSettings, DEFAULT_THRESHOLDS, type ThresholdSettings } from '@/shared/lib/thresholdConfig'
import {
  autoEnsureFeishuCliReady,
  checkFeishuCliUpdate,
  completeFeishuAuth,
  getFeishuAuthEffectiveState,
  getFeishuAuthPreferences,
  getFeishuAuthPresets,
  getFeishuAuthStatus,
  getFeishuAuthScopeCatalog,
  getFeishuCliHealth,
  initFeishuConfig,
  removeFeishuConfig,
  saveFeishuAuthPreferences,
  syncFeishuAuth,
  updateFeishuCli,
  type FeishuAuthEffectiveState,
  type FeishuAuthPreferences,
  type FeishuAuthPresetCatalog,
  type FeishuAuthScopeCatalog,
  type FeishuCliHealth,
  type FeishuCliResponse,
  type FeishuCliUpdateCheck,
} from '@/shared/lib/feishu/feishuClient'
import { openFeishuAuthUrl } from '@/shared/lib/feishu/openFeishuAuthUrl'

const FEISHU_AUTH_STORAGE_KEY = 'canmou:feishu-auth-domains'

const DEFAULT_FEISHU_AUTH_DOMAINS = ['calendar', 'contact', 'docs', 'drive', 'minutes', 'task']

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const normalizedLeft = [...left].sort()
  const normalizedRight = [...right].sort()
  return normalizedLeft.every((item, index) => item === normalizedRight[index])
}

function resolveFeishuPresetId(domains: string[], catalog: FeishuAuthPresetCatalog | null) {
  const preset = catalog?.presets.find((item) => sameStringSet(item.domains, domains))
  return preset?.id ?? 'custom'
}

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
  const [feishuScopeCatalog, setFeishuScopeCatalog] = useState<FeishuAuthScopeCatalog | null>(null)
  const [feishuPresetCatalog, setFeishuPresetCatalog] = useState<FeishuAuthPresetCatalog | null>(null)
  const [, setFeishuAuthPreferences] = useState<FeishuAuthPreferences | null>(null)
  const [feishuStatusError, setFeishuStatusError] = useState<string | null>(null)
  const [feishuStatusLoading, setFeishuStatusLoading] = useState(false)
  const [feishuAppId, setFeishuAppId] = useState('')
  const [feishuAppSecret, setFeishuAppSecret] = useState('')
  const [feishuConfigEditing, setFeishuConfigEditing] = useState(false)
  const [feishuSetupLoading, setFeishuSetupLoading] = useState(false)
  const [feishuAuthLoading, setFeishuAuthLoading] = useState(false)
  const [feishuAuthPayload, setFeishuAuthPayload] = useState<Record<string, unknown> | null>(null)
  const [feishuAuthDomains, setFeishuAuthDomains] = useState<string[]>(DEFAULT_FEISHU_AUTH_DOMAINS)
  const [feishuAuthPresetId, setFeishuAuthPresetId] = useState('basic')
  const [feishuAuthDirty, setFeishuAuthDirty] = useState(false)
  const [feishuEffectiveState, setFeishuEffectiveState] = useState<FeishuAuthEffectiveState | null>(null)
  const [feishuUpdateCheck, setFeishuUpdateCheck] = useState<FeishuCliUpdateCheck | null>(null)
  const [feishuUpdateLoading, setFeishuUpdateLoading] = useState(false)
  const [feishuDiagnosticsOpen, setFeishuDiagnosticsOpen] = useState(false)
  const domainSaveTimer = useRef<number | null>(null)

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
      if (domainSaveTimer.current !== null) {
        window.clearTimeout(domainSaveTimer.current)
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
      const health = await autoEnsureFeishuCliReady().catch(() => getFeishuCliHealth())
      setFeishuHealth(health)
      const [catalog, presets] = await Promise.all([
        getFeishuAuthScopeCatalog(),
        getFeishuAuthPresets(),
      ])
      setFeishuScopeCatalog(catalog)
      setFeishuPresetCatalog(presets)
      if (catalog.error && health.configured) {
        setFeishuStatusError(catalog.error)
      }
      try {
        const preferences = await getFeishuAuthPreferences()
        let effectivePreferences = preferences
        if (preferences.selectedDomains.length === 0) {
          try {
            const raw = localStorage.getItem(FEISHU_AUTH_STORAGE_KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed)) {
                const legacyDomains = parsed.filter(
                  (value): value is string => typeof value === 'string' && value.trim().length > 0,
                )
                if (legacyDomains.length) {
                  effectivePreferences = await saveFeishuAuthPreferences({ selectedDomains: legacyDomains })
                  localStorage.removeItem(FEISHU_AUTH_STORAGE_KEY)
                }
              }
            }
          } catch {
            // ignore legacy migration errors
          }
        }
        const selectedDomains = effectivePreferences.selectedDomains.length
          ? effectivePreferences.selectedDomains
          : DEFAULT_FEISHU_AUTH_DOMAINS
        setFeishuAuthPreferences(effectivePreferences)
        setFeishuAuthDomains(selectedDomains)
        setFeishuAuthPresetId(resolveFeishuPresetId(selectedDomains, presets))
        if (effectivePreferences.pendingDeviceCode || effectivePreferences.pendingVerificationUrl) {
          setFeishuAuthPayload({
            device_code: effectivePreferences.pendingDeviceCode,
            verification_uri_complete: effectivePreferences.pendingVerificationUrl,
          })
        } else {
          setFeishuAuthPayload(null)
        }
        try {
          const [effectiveState, updateCheck] = await Promise.all([
            getFeishuAuthEffectiveState(),
            checkFeishuCliUpdate(),
          ])
          setFeishuEffectiveState(effectiveState)
          setFeishuUpdateCheck(updateCheck)
          setFeishuAuthDirty(effectiveState.needsSync)
        } catch {
          setFeishuEffectiveState(null)
          setFeishuUpdateCheck(null)
          setFeishuAuthDirty(false)
        }
      } catch {
        setFeishuAuthPreferences(null)
        setFeishuEffectiveState(null)
        setFeishuUpdateCheck(null)
      }
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
      setFeishuConfigEditing(false)
      showToast('飞书应用配置已保存')
      await loadFeishuStatus()
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '飞书应用配置失败'))
    } finally {
      setFeishuSetupLoading(false)
    }
  }

  const handleFeishuAuthDomainToggle = (domain: string) => {
    const nextDomains = feishuAuthDomains.includes(domain)
      ? feishuAuthDomains.filter((value) => value !== domain)
      : [...feishuAuthDomains, domain]

    setFeishuAuthDomains(nextDomains)
    setFeishuAuthPresetId(resolveFeishuPresetId(nextDomains, feishuPresetCatalog))
    setFeishuAuthDirty(true)
    setFeishuAuthPayload(null)

    if (domainSaveTimer.current !== null) {
      window.clearTimeout(domainSaveTimer.current)
    }
    domainSaveTimer.current = window.setTimeout(() => {
      domainSaveTimer.current = null
      void saveFeishuAuthPreferences({ selectedDomains: nextDomains })
        .then((saved) => setFeishuAuthPreferences(saved))
        .catch(() => {})
    }, 300)
  }

  const handleFeishuPresetSelect = (presetId: string) => {
    const preset = feishuPresetCatalog?.presets.find((item) => item.id === presetId)
    if (!preset) return
    setFeishuAuthPresetId(preset.id)
    setFeishuAuthDomains(preset.domains)
    setFeishuAuthDirty(true)
    setFeishuAuthPayload(null)
    void saveFeishuAuthPreferences({ selectedDomains: preset.domains })
      .then((saved) => setFeishuAuthPreferences(saved))
      .catch(() => {})
  }

  const handleFeishuAuthSync = async () => {
    if (feishuAuthDomains.length === 0) {
      setFeishuStatusError('请至少选择一个飞书授权范围')
      return
    }
    setFeishuAuthLoading(true)
    setFeishuStatusError(null)
    try {
      const preferences = await saveFeishuAuthPreferences({ selectedDomains: feishuAuthDomains })
      setFeishuAuthPreferences(preferences)
      const result = await syncFeishuAuth({ selectedDomains: feishuAuthDomains })
      setFeishuAuthPreferences((previous) => ({
        selectedDomains: result.selectedDomains,
        lastSyncedDomains: result.lastSyncedDomains,
        pendingSyncDomains: previous?.pendingSyncDomains ?? [],
        pendingDeviceCode: result.pendingDeviceCode ?? previous?.pendingDeviceCode ?? null,
        pendingVerificationUrl: result.verificationUrl ?? null,
      }))
      setFeishuAuthPayload({
        device_code: result.pendingDeviceCode ?? null,
        verification_uri_complete: result.verificationUrl ?? null,
      })
      if (result.verificationUrl) {
        const opened = await openFeishuAuthUrl(result.verificationUrl)
        if (!opened) {
          showToast('授权链接已复制，请在浏览器中打开')
        }
      }
      setFeishuAuthDirty(false)
      showToast(result.reauthRequired ? '已重置旧授权，请重新完成授权' : '授权链接已更新')
      await loadFeishuStatus()
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '飞书授权同步失败'))
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
      setFeishuScopeCatalog(null)
      setFeishuAuthPreferences(null)
      setFeishuConfigEditing(false)
      showToast('飞书配置已清除')
      await loadFeishuStatus()
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, '清除飞书配置失败'))
    } finally {
      setFeishuSetupLoading(false)
    }
  }

  const handleFeishuCliUpdate = async () => {
    setFeishuUpdateLoading(true)
    setFeishuStatusError(null)
    try {
      await updateFeishuCli()
      showToast('lark-cli 已更新')
      await loadFeishuStatus()
    } catch (error) {
      setFeishuStatusError(getErrorMessage(error, 'lark-cli 更新失败'))
    } finally {
      setFeishuUpdateLoading(false)
    }
  }

  const handleCopyFeishuUrl = async () => {
    const url = extractFeishuUrl(feishuAuthPayload)
    if (!url) return
    await navigator.clipboard.writeText(url)
    showToast('授权链接已复制')
  }

  const handleOpenFeishuUrl = async () => {
    const url = extractFeishuUrl(feishuAuthPayload)
    if (!url) return
    const opened = await openFeishuAuthUrl(url)
    showToast(opened ? '已打开浏览器授权' : '授权链接已复制，请在浏览器中打开')
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
  const feishuDomains = feishuScopeCatalog?.domains ?? []
  const selectedFeishuDomainLabels = feishuDomains
    .filter((domain) => feishuAuthDomains.includes(domain.id))
    .map((domain) => domain.label)
  const feishuConfigured = Boolean(feishuHealth?.configured)
  const feishuAuthenticated = Boolean(feishuHealth?.authenticated)
  const feishuPendingUrl = extractFeishuUrl(feishuAuthPayload)
  const feishuNeedsSync = Boolean(feishuEffectiveState?.needsSync || feishuAuthDirty)
  const feishuConnectionLabel = !feishuHealth
    ? '尚未检查'
    : !feishuHealth.installed
      ? '未检测到 CLI'
      : !feishuConfigured
        ? '未配置应用'
        : feishuEffectiveState
          ? feishuEffectiveState.needsSync
            ? '授权需同步'
            : feishuEffectiveState.pendingAuthUrl
              ? '等待网页登录'
              : feishuEffectiveState.authenticated
                ? '已连接'
                : '待授权'
          : feishuPendingUrl
            ? '等待网页登录'
            : feishuAuthenticated
              ? '已连接'
              : '待授权'
  const feishuSyncButtonLabel = feishuNeedsSync ? '保存并同步授权' : '同步授权'
  const getFeishuDomainBadge = (domainId: string, available: boolean) => {
    if (!available) return { label: '未开通', tone: 'muted' as const }
    if (feishuEffectiveState?.grantedDomains.includes(domainId)) {
      return { label: '已授权', tone: 'success' as const }
    }
    if (feishuAuthDomains.includes(domainId)) {
      return { label: '待同步', tone: 'warning' as const }
    }
    return null
  }
  const showFeishuConfigForm = !feishuConfigured || feishuConfigEditing

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-gray-800">飞书连接</h3>
                <p className="mt-1 text-caption text-gray-500">配置应用后，直接选择业务域并同步授权。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-caption font-medium ${
                  feishuConnectionLabel === '已连接'
                    ? 'bg-success-100 text-success-700'
                    : feishuConnectionLabel === '授权需同步' || feishuConnectionLabel === '等待网页登录'
                      ? 'bg-warning-100 text-warning-700'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {feishuConnectionLabel}
                </span>
                <button
                  type="button"
                  onClick={() => void loadFeishuStatus()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60"
                  disabled={feishuStatusLoading}
                  title="刷新状态"
                >
                  <RefreshCw size={15} className={feishuStatusLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-caption text-slate-500"><ShieldCheck size={15} /> CLI</div>
                <div className={feishuHealth?.installed ? 'mt-1.5 text-body font-medium text-success-700' : 'mt-1.5 text-body font-medium text-warning-700'}>
                  {feishuHealth ? (feishuHealth.installed ? '内置可用' : '未检测到') : '尚未检查'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-caption text-slate-500"><KeyRound size={15} /> 应用配置</div>
                <div className={feishuConfigured ? 'mt-1.5 text-body font-medium text-success-700' : 'mt-1.5 text-body font-medium text-warning-700'}>
                  {feishuHealth ? (feishuConfigured ? '已配置' : '未配置') : '尚未检查'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-caption text-slate-500"><Check size={15} /> 用户授权</div>
                <div className={feishuAuthenticated ? 'mt-1.5 text-body font-medium text-success-700' : 'mt-1.5 text-body font-medium text-warning-700'}>
                  {feishuHealth ? (feishuAuthenticated ? '已授权' : '未授权') : '尚未检查'}
                </div>
              </div>
            </div>

            {(feishuStatusError || feishuHealth?.error) && (
              <div className="mt-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-body text-warning-800">
                {feishuStatusError || feishuHealth?.error}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-body font-medium text-slate-800">飞书应用</div>
                  {feishuConfigured && !showFeishuConfigForm && (
                    <button
                      type="button"
                      onClick={() => setFeishuConfigEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-caption font-medium text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      <Settings2 size={13} />
                      修改
                    </button>
                  )}
                </div>
                {showFeishuConfigForm ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label htmlFor="feishu-app-id" className="mb-1.5 block text-caption text-slate-600">App ID</label>
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
                        <label htmlFor="feishu-app-secret" className="mb-1.5 block text-caption text-slate-600">App Secret</label>
                        <input
                          id="feishu-app-secret"
                          type="password"
                          value={feishuAppSecret}
                          onChange={(event) => setFeishuAppSecret(event.target.value)}
                          className="input input-bordered input-sm h-11 w-full border-slate-200 bg-white font-mono text-caption"
                          placeholder="仅通过本机 CLI 保存"
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
                        保存应用
                      </button>
                      {feishuConfigured && (
                        <button
                          type="button"
                          onClick={() => setFeishuConfigEditing(false)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-body font-medium text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          取消
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleFeishuConfigRemove()}
                        disabled={feishuSetupLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-body font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        清除
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-body text-slate-600">应用已配置，可直接同步授权范围。</div>
                )}
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-body font-medium text-slate-800">lark-cli 版本</div>
                      {(feishuUpdateCheck?.updateAvailable || feishuHealth?.updateAvailable) && (
                        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                          可更新
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-caption text-slate-500">
                      当前 {feishuUpdateCheck?.activeVersion || feishuHealth?.activeVersion || feishuHealth?.version || '-'}
                      {' · '}
                      内置 {feishuUpdateCheck?.bundledVersion || feishuHealth?.bundledVersion || '-'}
                      {' · '}
                      最新 {feishuUpdateCheck?.latestVersion || feishuHealth?.requiredVersion || '-'}
                    </p>
                    <p className="mt-1 text-caption text-slate-500">
                      来源 {feishuUpdateCheck?.activeSource || feishuHealth?.source || '-'}
                      {feishuHealth?.updateStatus ? ` · ${feishuHealth.updateStatus}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFeishuCliUpdate()}
                    disabled={feishuUpdateLoading || !(feishuUpdateCheck?.updateAvailable || feishuHealth?.updateAvailable)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {feishuUpdateLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    一键更新
                  </button>
                </div>
              </div>

              {feishuEffectiveState?.needsSync && (
                <div className="sticky top-16 z-10 rounded-[18px] border border-warning-200 bg-warning-50/95 px-4 py-3 shadow-sm backdrop-blur-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-body text-warning-800">
                      授权范围与飞书侧不一致，请保存并同步授权后完成网页确认。
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleFeishuAuthSync()}
                      disabled={feishuAuthLoading || !feishuConfigured || feishuAuthDomains.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-warning-600 px-4 py-2 text-body font-medium text-white transition-colors hover:bg-warning-700 disabled:opacity-60"
                    >
                      {feishuAuthLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      保存并同步授权
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-body font-medium text-slate-800">使用场景</div>
                    <p className="mt-1 text-caption text-slate-500">
                      已选择：{selectedFeishuDomainLabels.length ? selectedFeishuDomainLabels.join('、') : '未选择'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFeishuAuthSync()}
                    disabled={feishuAuthLoading || !feishuConfigured || feishuAuthDomains.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-body font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                  >
                    {feishuAuthLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {feishuSyncButtonLabel}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {(feishuPresetCatalog?.presets ?? []).map((preset) => {
                    const active = feishuAuthPresetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleFeishuPresetSelect(preset.id)}
                        disabled={feishuAuthLoading}
                        className={`min-h-[5.25rem] rounded-xl border px-3 py-3 text-left transition-colors disabled:opacity-60 ${
                          active
                            ? 'border-primary-200 bg-primary-50/70 text-slate-900'
                            : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-body font-medium">
                          {preset.label}
                          {preset.recommended && (
                            <span className="rounded bg-success-100 px-1.5 py-0.5 text-[10px] font-medium text-success-700">
                              推荐
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                          {preset.description}
                        </span>
                      </button>
                    )
                  })}
                  {feishuAuthPresetId === 'custom' && (
                    <div className="min-h-[5.25rem] rounded-xl border border-warning-200 bg-warning-50/70 px-3 py-3 text-left text-warning-800">
                      <div className="text-body font-medium">自定义范围</div>
                      <div className="mt-1 text-[11px] leading-5">当前选择与预设不同，可在下方高级范围中调整。</div>
                    </div>
                  )}
                </div>

                <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <summary className="cursor-pointer text-body font-medium text-slate-700">高级权限范围</summary>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                  {feishuDomains.map((option) => {
                    const checked = feishuAuthDomains.includes(option.id)
                    const disabled = feishuAuthLoading || (!option.available && !checked)
                    const badge = getFeishuDomainBadge(option.id, option.available)
                    return (
                      <label
                        key={option.id}
                        className={`flex min-h-[4rem] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                          checked
                            ? 'border-primary-200 bg-primary-50/60 text-slate-900'
                            : disabled
                              ? 'border-slate-200 bg-slate-50/40 text-slate-400 opacity-60'
                              : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                        }`}
                        title={option.available ? option.description : '应用后台未开通'}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm border-slate-300"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => handleFeishuAuthDomainToggle(option.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="block truncate text-body font-medium">{option.label}</span>
                            {badge && (
                              <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
                                badge.tone === 'success'
                                  ? 'bg-success-100 text-success-700'
                                  : badge.tone === 'warning'
                                    ? 'bg-warning-100 text-warning-700'
                                    : 'bg-slate-100 text-slate-500'
                              }`}>
                                {badge.label}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {option.available ? (option.recommended ? '推荐' : `${option.enabledScopeCount} 项权限`) : '未开通'}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                </details>

                {feishuPendingUrl && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-caption text-slate-500">授权链接</div>
                    <div className="break-all rounded-lg bg-white px-3 py-2 font-mono text-caption text-slate-700">
                      {feishuPendingUrl}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenFeishuUrl()}
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
                      <button
                        type="button"
                        onClick={() => void handleFeishuAuthComplete()}
                        disabled={feishuAuthLoading || !extractDeviceCode(feishuAuthPayload)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-caption font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                      >
                        <Check size={13} />
                        已完成授权
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setFeishuDiagnosticsOpen((value) => !value)}
                  className="flex w-full items-center justify-between text-left text-body font-medium text-slate-800"
                >
                  <span>诊断详情</span>
                  <span className="text-caption text-slate-500">{feishuDiagnosticsOpen ? '收起' : '展开'}</span>
                </button>
                {feishuDiagnosticsOpen && (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-caption text-slate-600">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-slate-500">版本</div>
                      <div className="mt-1 font-mono">{feishuHealth?.version || '-'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-slate-500">应用</div>
                      <div className="mt-1 font-mono">{feishuScopeCatalog?.appId || '-'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-slate-500">品牌</div>
                      <div className="mt-1">{feishuScopeCatalog?.brand || 'feishu'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-slate-500">应用后台已开通 scope</div>
                      <div className="mt-1">{feishuScopeCatalog?.appScopes.length ?? 0} 项</div>
                    </div>
                    <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                      <div className="text-slate-500">登录状态</div>
                      <div className="mt-1 break-all">
                        {feishuAuthStatus?.parsed_json && typeof feishuAuthStatus.parsed_json === 'object'
                          ? '已获取'
                          : feishuAuthStatus?.stdout
                            ? '已获取'
                            : '未获取'}
                      </div>
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
