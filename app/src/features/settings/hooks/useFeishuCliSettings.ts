import { useEffect, useState } from 'react'

import { getErrorMessage } from '@/shared/lib/errorMessage'
import {
  completeFeishuAuth,
  getFeishuAuthPreferences,
  getFeishuAuthStatus,
  getFeishuAuthScopeCatalog,
  getFeishuCliHealth,
  initFeishuConfig,
  removeFeishuConfig,
  saveFeishuAuthPreferences,
  syncFeishuAuth,
  type FeishuAuthPreferences,
  type FeishuAuthScopeCatalog,
  type FeishuCliHealth,
  type FeishuCliResponse,
} from '@/shared/lib/feishu/feishuClient'

const FEISHU_AUTH_STORAGE_KEY = 'canmou:feishu-auth-domains'

const DEFAULT_FEISHU_AUTH_DOMAINS = ['calendar', 'contact', 'docs', 'drive', 'minutes', 'task']

function loadFeishuAuthDomains(): string[] {
  try {
    const raw = localStorage.getItem(FEISHU_AUTH_STORAGE_KEY)
    if (!raw) return DEFAULT_FEISHU_AUTH_DOMAINS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_FEISHU_AUTH_DOMAINS
    const values = parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    return values.length ? values : DEFAULT_FEISHU_AUTH_DOMAINS
  } catch {
    return DEFAULT_FEISHU_AUTH_DOMAINS
  }
}

function hasStoredFeishuAuthDomains() {
  try {
    return localStorage.getItem(FEISHU_AUTH_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

function pickNestedString(value: unknown, keys: string[]): string {
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

export function extractFeishuUrl(payload: Record<string, unknown> | null) {
  return pickNestedString(payload, ['verification_uri_complete', 'verification_url', 'verification_uri', 'console_url'])
}

export function extractDeviceCode(payload: Record<string, unknown> | null) {
  return pickNestedString(payload, ['device_code'])
}

export function useFeishuCliSettings(
  searchParams: URLSearchParams,
  showToast: (message: string) => void,
) {
  const [feishuHealth, setFeishuHealth] = useState<FeishuCliHealth | null>(null)
  const [feishuAuthStatus, setFeishuAuthStatus] = useState<FeishuCliResponse | null>(null)
  const [feishuScopeCatalog, setFeishuScopeCatalog] = useState<FeishuAuthScopeCatalog | null>(null)
  const [feishuAuthPreferences, setFeishuAuthPreferences] = useState<FeishuAuthPreferences | null>(null)
  const [feishuStatusError, setFeishuStatusError] = useState<string | null>(null)
  const [feishuStatusLoading, setFeishuStatusLoading] = useState(false)
  const [feishuAppId, setFeishuAppId] = useState('')
  const [feishuAppSecret, setFeishuAppSecret] = useState('')
  const [feishuConfigEditing, setFeishuConfigEditing] = useState(false)
  const [feishuSetupLoading, setFeishuSetupLoading] = useState(false)
  const [feishuAuthLoading, setFeishuAuthLoading] = useState(false)
  const [feishuAuthPayload, setFeishuAuthPayload] = useState<Record<string, unknown> | null>(null)
  const [feishuAuthDomains, setFeishuAuthDomains] = useState<string[]>(() => loadFeishuAuthDomains())
  const [feishuAuthDirty, setFeishuAuthDirty] = useState(false)
  const [feishuDiagnosticsOpen, setFeishuDiagnosticsOpen] = useState(false)

  const loadFeishuStatus = async () => {
    setFeishuStatusLoading(true)
    setFeishuStatusError(null)
    setFeishuAuthStatus(null)
    try {
      const health = await getFeishuCliHealth()
      setFeishuHealth(health)
      const catalog = await getFeishuAuthScopeCatalog()
      setFeishuScopeCatalog(catalog)
      if (catalog.error && health.configured) {
        setFeishuStatusError(catalog.error)
      }
      try {
        const preferences = await getFeishuAuthPreferences()
        let effectivePreferences = preferences
        const shouldMigrateLocalDomains =
          preferences.lastSyncedDomains.length === 0 &&
          hasStoredFeishuAuthDomains()
        const storedDomains = shouldMigrateLocalDomains
          ? loadFeishuAuthDomains()
          : preferences.selectedDomains.length
            ? preferences.selectedDomains
            : loadFeishuAuthDomains()
        if (shouldMigrateLocalDomains && storedDomains.length) {
          effectivePreferences = await saveFeishuAuthPreferences({ selectedDomains: storedDomains })
        }
        setFeishuAuthPreferences(effectivePreferences)
        setFeishuAuthDomains(storedDomains)
        if (effectivePreferences.pendingDeviceCode || effectivePreferences.pendingVerificationUrl) {
          setFeishuAuthPayload({
            device_code: effectivePreferences.pendingDeviceCode,
            verification_uri_complete: effectivePreferences.pendingVerificationUrl,
          })
        } else {
          setFeishuAuthPayload(null)
        }
        setFeishuAuthDirty(false)
      } catch {
        setFeishuAuthPreferences(null)
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
    localStorage.setItem(FEISHU_AUTH_STORAGE_KEY, JSON.stringify(nextDomains))
    setFeishuAuthDirty(true)
    setFeishuAuthPayload(null)
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
        pendingDeviceCode: result.pendingDeviceCode ?? previous?.pendingDeviceCode ?? null,
        pendingVerificationUrl: result.verificationUrl ?? null,
      }))
      setFeishuAuthPayload({
        device_code: result.pendingDeviceCode ?? null,
        verification_uri_complete: result.verificationUrl ?? null,
      })
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

  const feishuDomains = feishuScopeCatalog?.domains ?? []
  const selectedFeishuDomainLabels = feishuDomains
    .filter((domain) => feishuAuthDomains.includes(domain.id))
    .map((domain) => domain.label)
  const feishuConfigured = Boolean(feishuHealth?.configured)
  const feishuAuthenticated = Boolean(feishuHealth?.authenticated)
  const feishuPendingUrl = extractFeishuUrl(feishuAuthPayload)
  const feishuDomainSelectionChanged = Boolean(
    feishuAuthPreferences &&
    feishuAuthDomains.join('|') !== feishuAuthPreferences.lastSyncedDomains.join('|'),
  )
  const feishuConnectionLabel = !feishuHealth
    ? '尚未检查'
    : !feishuHealth.installed
      ? '未检测到 CLI'
      : !feishuConfigured
        ? '未配置应用'
        : feishuPendingUrl
          ? '等待网页登录'
          : feishuAuthDirty || feishuDomainSelectionChanged
            ? '授权需同步'
            : feishuAuthenticated
              ? '已连接'
              : '待授权'
  const showFeishuConfigForm = !feishuConfigured || feishuConfigEditing

  return {
    feishuHealth,
    feishuAuthStatus,
    feishuScopeCatalog,
    feishuAuthPreferences,
    feishuStatusError,
    feishuStatusLoading,
    feishuAppId,
    setFeishuAppId,
    feishuAppSecret,
    setFeishuAppSecret,
    feishuConfigEditing,
    setFeishuConfigEditing,
    feishuSetupLoading,
    feishuAuthLoading,
    feishuAuthPayload,
    feishuAuthDomains,
    feishuAuthDirty,
    feishuDiagnosticsOpen,
    setFeishuDiagnosticsOpen,
    loadFeishuStatus,
    handleFeishuConfigInit,
    handleFeishuAuthDomainToggle,
    handleFeishuAuthSync,
    handleFeishuAuthComplete,
    handleFeishuConfigRemove,
    handleCopyFeishuUrl,
    feishuDomains,
    selectedFeishuDomainLabels,
    feishuConfigured,
    feishuAuthenticated,
    feishuPendingUrl,
    feishuDomainSelectionChanged,
    feishuConnectionLabel,
    showFeishuConfigForm,
  }
}
