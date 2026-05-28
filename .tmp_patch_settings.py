import pathlib

path = pathlib.Path(r'D:/Code/ZhiHuiCanMou/app/src/features/settings/pages/SettingsPage.tsx')
content = path.read_text(encoding='utf-8')

replacements = [
    (
        """import {
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
}""",
        """import {
  checkFeishuCliUpdate,
  completeFeishuAuth,
  getFeishuAuthEffectiveState,
  getFeishuAuthPreferences,
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
  type FeishuAuthScopeCatalog,
  type FeishuCliHealth,
  type FeishuCliResponse,
  type FeishuCliUpdateCheck,
} from '@/shared/lib/feishu/feishuClient'

const FEISHU_AUTH_STORAGE_KEY = 'canmou:feishu-auth-domains'

const DEFAULT_FEISHU_AUTH_DOMAINS = ['calendar', 'contact', 'docs', 'drive', 'minutes', 'task']""",
    ),
    (
        """  const [feishuAuthDomains, setFeishuAuthDomains] = useState<string[]>(() => loadFeishuAuthDomains())
  const [feishuAuthDirty, setFeishuAuthDirty] = useState(false)
  const [feishuDiagnosticsOpen, setFeishuDiagnosticsOpen] = useState(false)""",
        """  const [feishuAuthDomains, setFeishuAuthDomains] = useState<string[]>(DEFAULT_FEISHU_AUTH_DOMAINS)
  const [feishuAuthDirty, setFeishuAuthDirty] = useState(false)
  const [feishuEffectiveState, setFeishuEffectiveState] = useState<FeishuAuthEffectiveState | null>(null)
  const [feishuUpdateCheck, setFeishuUpdateCheck] = useState<FeishuCliUpdateCheck | null>(null)
  const [feishuUpdateLoading, setFeishuUpdateLoading] = useState(false)
  const [feishuDiagnosticsOpen, setFeishuDiagnosticsOpen] = useState(false)
  const domainSaveTimer = useRef<number | null>(null)""",
    ),
    (
        """  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])""",
        """  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
      if (domainSaveTimer.current !== null) {
        window.clearTimeout(domainSaveTimer.current)
      }
    }
  }, [])""",
    ),
    (
        """      try {
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
      }""",
        """      try {
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
      }""",
    ),
    (
        """  const handleFeishuAuthDomainToggle = (domain: string) => {
    const nextDomains = feishuAuthDomains.includes(domain)
      ? feishuAuthDomains.filter((value) => value !== domain)
      : [...feishuAuthDomains, domain]

    setFeishuAuthDomains(nextDomains)
    localStorage.setItem(FEISHU_AUTH_STORAGE_KEY, JSON.stringify(nextDomains))
    setFeishuAuthDirty(true)
    setFeishuAuthPayload(null)
  }""",
        """  const handleFeishuAuthDomainToggle = (domain: string) => {
    const nextDomains = feishuAuthDomains.includes(domain)
      ? feishuAuthDomains.filter((value) => value !== domain)
      : [...feishuAuthDomains, domain]

    setFeishuAuthDomains(nextDomains)
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
  }""",
    ),
    (
        """      setFeishuAuthPreferences((previous) => ({
        selectedDomains: result.selectedDomains,
        lastSyncedDomains: result.lastSyncedDomains,
        pendingDeviceCode: result.pendingDeviceCode ?? previous?.pendingDeviceCode ?? null,
        pendingVerificationUrl: result.verificationUrl ?? null,
      }))
      setFeishuAuthPayload({
        device_code: result.pendingDeviceCode ?? null,
        verification_uri_complete: result.verificationUrl ?? null,
      })
      setFeishuAuthDirty(false)""",
        """      setFeishuAuthPreferences((previous) => ({
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
        window.open(result.verificationUrl, '_blank', 'noopener,noreferrer')
      }
      setFeishuAuthDirty(false)""",
    ),
    (
        """  const handleCopyFeishuUrl = async () => {""",
        """  const handleFeishuCliUpdate = async () => {
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

  const handleCopyFeishuUrl = async () => {""",
    ),
    (
        """  const feishuDomainSelectionChanged = Boolean(
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
  const showFeishuConfigForm = !feishuConfigured || feishuConfigEditing""",
        """  const feishuNeedsSync = Boolean(feishuEffectiveState?.needsSync || feishuAuthDirty)
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
  const showFeishuConfigForm = !feishuConfigured || feishuConfigEditing""",
    ),
]

for i, (old, new) in enumerate(replacements):
    if old not in content:
        raise SystemExit(f'Replacement {i+1} failed: old text not found')
    content = content.replace(old, new, 1)

# UI: version card before auth section sticky bar, update sync button, domain badges
old_auth_section = """              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-body font-medium text-slate-800">授权范围</div>"""

new_auth_section = """              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
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
                    <div className="text-body font-medium text-slate-800">授权范围</div>"""

if old_auth_section not in content:
    raise SystemExit('Auth section replacement failed')
content = content.replace(old_auth_section, new_auth_section, 1)

content = content.replace(
    """                    {feishuAuthLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    同步授权
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                  {feishuDomains.map((option) => {
                    const checked = feishuAuthDomains.includes(option.id)
                    const disabled = feishuAuthLoading || (!option.available && !checked)
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
                        <span className="min-w-0">
                          <span className="block truncate text-body font-medium">{option.label}</span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {option.available ? (option.recommended ? '推荐' : `${option.enabledScopeCount} 项权限`) : '未开通'}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>

                {(feishuAuthDirty || feishuDomainSelectionChanged) && (
                  <div className="mt-3 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-caption text-warning-700">
                    授权范围已变更，点击“同步授权”后使用新链接完成确认。
                  </div>
                )}""",
    """                    {feishuAuthLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {feishuSyncButtonLabel}
                  </button>
                </div>

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
                </div>""",
    1,
)

path.write_text(content, encoding='utf-8')
print('Patch applied successfully')
