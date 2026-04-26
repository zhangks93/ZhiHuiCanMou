import { invokeTauri, isTauriRuntime } from '@/shared/lib/tauri'

export type LLMProvider = 'openai' | 'claude' | 'deepseek' | 'kimi' | 'minimax' | 'glm' | 'openrouter'

export interface ProviderSettings {
  apiUrl: string
  apiKey?: string
  model: string
}

export interface LLMConfig {
  provider: LLMProvider
  apiUrl: string
  apiKey: string
  model: string
}

export interface StoredProviderSettings {
  apiUrl: string
  apiKey: string
  model: string
}

export interface StoredLLMSettings {
  provider: LLMProvider
  providers: Partial<Record<LLMProvider, StoredProviderSettings>>
}

export interface ThresholdConfig {
  yellowThreshold: number
  redThreshold: number
}

export interface ThresholdSettings {
  default: ThresholdConfig
}

export interface StoredSettingsSnapshot {
  llm: StoredLLMSettings | null
  thresholds: ThresholdSettings
  enabledModules: string[]
}

interface StoredSettingsSnapshotWire {
  llm: StoredLLMSettings | null
  thresholds: ThresholdSettings | null
  enabledModules: string[] | null
}

const LLM_STORAGE_KEY = 'llm_config'
const LLM_SECRET_STORAGE_KEY = 'llm_config_session_secret'
const THRESHOLD_STORAGE_KEY = 'biz_data_threshold_settings'
const ENABLED_MODULES_KEY = 'canmou_enabled_modules'

const VALID_PROVIDERS: readonly LLMProvider[] = ['openai', 'claude', 'deepseek', 'kimi', 'minimax', 'glm', 'openrouter']

export const DEFAULT_URLS: Record<LLMProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  deepseek: 'https://api.deepseek.com/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
  minimax: 'https://api.minimaxi.com/v1/chat/completions',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
  deepseek: 'deepseek-chat',
  kimi: 'moonshot-v1-8k',
  minimax: 'MiniMax-M2.5',
  glm: 'glm-4.7',
  openrouter: 'google/gemini-2.5-pro-preview',
}

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  default: {
    yellowThreshold: 0.8,
    redThreshold: 0.7,
  },
}

export const DEFAULT_ENABLED_MODULES = [
  'schedule',
  'biz-data',
  'opportunity',
  'trip',
  'attendance',
  'org-data',
  'planning',
  'links',
  'ai',
]

function normalizeEnabledModules(moduleIds: string[]): string[] {
  const normalized = [...moduleIds]
  const hasPlanning = normalized.includes('planning')
  const shouldExposePlanning = normalized.includes('org-data') || normalized.includes('biz-data')

  if (!hasPlanning && shouldExposePlanning) {
    const orgIndex = normalized.indexOf('org-data')
    if (orgIndex >= 0) {
      normalized.splice(orgIndex + 1, 0, 'planning')
    } else {
      normalized.push('planning')
    }
  }

  return normalized
}

let settingsState: StoredSettingsSnapshot = {
  llm: null,
  thresholds: DEFAULT_THRESHOLDS,
  enabledModules: [...DEFAULT_ENABLED_MODULES],
}

let initializationPromise: Promise<void> | null = null
const listeners = new Set<(snapshot: StoredSettingsSnapshot) => void>()

function isProvider(value: unknown): value is LLMProvider {
  return typeof value === 'string' && VALID_PROVIDERS.includes(value as LLMProvider)
}

function normalizeProvider(value: unknown): LLMProvider {
  return isProvider(value) ? value : 'openai'
}

function cloneSnapshot(snapshot: StoredSettingsSnapshot): StoredSettingsSnapshot {
  return {
    llm: snapshot.llm
      ? {
          provider: snapshot.llm.provider,
          providers: Object.fromEntries(
            Object.entries(snapshot.llm.providers).map(([provider, settings]) => [
              provider,
              settings ? { ...settings } : settings,
            ]),
          ) as StoredLLMSettings['providers'],
        }
      : null,
    thresholds: {
      default: { ...snapshot.thresholds.default },
    },
    enabledModules: normalizeEnabledModules(snapshot.enabledModules),
  }
}

function emitSettingsSnapshot() {
  const snapshot = getSettingsSnapshot()
  listeners.forEach((listener) => listener(snapshot))
}

function readJsonStorage<T>(storage: Storage | null, key: string): T | null {
  if (!storage) return null

  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function removeLegacyBrowserKeys() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LLM_STORAGE_KEY)
  window.sessionStorage.removeItem(LLM_SECRET_STORAGE_KEY)
  window.localStorage.removeItem(THRESHOLD_STORAGE_KEY)
  window.localStorage.removeItem(ENABLED_MODULES_KEY)
}

function deserializeLegacyLLMStore(raw: string): StoredLLMSettings | null {
  const parsed = JSON.parse(raw)
  if (parsed?.providers && typeof parsed.providers === 'object') {
    const providers: StoredLLMSettings['providers'] = {}

    for (const [rawProvider, rawSettings] of Object.entries(parsed.providers as Record<string, unknown>)) {
      const provider = normalizeProvider(rawProvider)
      if (!rawSettings || typeof rawSettings !== 'object') continue

      const settings = rawSettings as Partial<ProviderSettings>
      providers[provider] = {
        apiUrl: typeof settings.apiUrl === 'string' && settings.apiUrl.trim() ? settings.apiUrl : DEFAULT_URLS[provider],
        apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
        model: typeof settings.model === 'string' && settings.model.trim() ? settings.model : DEFAULT_MODELS[provider],
      }
    }

    return {
      provider: normalizeProvider(parsed.provider),
      providers,
    }
  }

  if (parsed?.provider && parsed?.apiKey) {
    const provider = normalizeProvider(parsed.provider)
    return {
      provider,
      providers: {
        [provider]: {
          apiUrl: typeof parsed.apiUrl === 'string' && parsed.apiUrl.trim() ? parsed.apiUrl : DEFAULT_URLS[provider],
          apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
          model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : DEFAULT_MODELS[provider],
        },
      },
    }
  }

  return null
}

function readLegacyBrowserSnapshot(): StoredSettingsSnapshot {
  const fallback = cloneSnapshot({
    llm: null,
    thresholds: DEFAULT_THRESHOLDS,
    enabledModules: [...DEFAULT_ENABLED_MODULES],
  })

  if (typeof window === 'undefined') {
    return fallback
  }

  let llm: StoredLLMSettings | null = null
  const llmRaw = window.localStorage.getItem(LLM_STORAGE_KEY)
  if (llmRaw) {
    try {
      llm = deserializeLegacyLLMStore(llmRaw)
    } catch {
      llm = null
    }
  }

  const sessionSecret = readJsonStorage<{ provider?: unknown; apiKey?: unknown }>(window.sessionStorage, LLM_SECRET_STORAGE_KEY)
  if (llm && isProvider(sessionSecret?.provider) && typeof sessionSecret.apiKey === 'string') {
    const existing = llm.providers[sessionSecret.provider]
    if (existing) {
      llm.providers[sessionSecret.provider] = {
        ...existing,
        apiKey: sessionSecret.apiKey,
      }
    }
  }

  const thresholds = readJsonStorage<ThresholdSettings>(window.localStorage, THRESHOLD_STORAGE_KEY)
  const enabledModules = readJsonStorage<string[]>(window.localStorage, ENABLED_MODULES_KEY)

  return {
    llm,
    thresholds: thresholds?.default?.yellowThreshold != null && thresholds?.default?.redThreshold != null
      ? thresholds
      : fallback.thresholds,
    enabledModules: normalizeEnabledModules(Array.isArray(enabledModules) ? enabledModules : fallback.enabledModules),
  }
}

function normalizeWireSnapshot(snapshot: StoredSettingsSnapshotWire | null | undefined): StoredSettingsSnapshot {
  return {
    llm: snapshot?.llm ?? null,
    thresholds:
      snapshot?.thresholds?.default?.yellowThreshold != null &&
      snapshot.thresholds.default.redThreshold != null
        ? snapshot.thresholds
        : DEFAULT_THRESHOLDS,
    enabledModules: normalizeEnabledModules(Array.isArray(snapshot?.enabledModules)
      ? snapshot.enabledModules
      : [...DEFAULT_ENABLED_MODULES]),
  }
}

async function persistLlmToTauri(llm: StoredLLMSettings | null) {
  if (!isTauriRuntime()) return

  if (!llm) {
    await invokeTauri('settings_clear_llm_config')
    return
  }

  await invokeTauri('settings_save_llm_config', { settings: llm })
}

async function persistThresholdsToTauri(settings: ThresholdSettings) {
  if (!isTauriRuntime()) return
  await invokeTauri('settings_save_threshold_settings', { settings })
}

async function persistEnabledModulesToTauri(moduleIds: string[]) {
  if (!isTauriRuntime()) return
  await invokeTauri('settings_save_enabled_modules', { moduleIds })
}

async function hydrateFromTauri() {
  const existing = normalizeWireSnapshot(
    await invokeTauri<StoredSettingsSnapshotWire>('settings_get_all'),
  )

  const legacy = readLegacyBrowserSnapshot()
  const hasExisting =
    existing.llm !== null ||
    existing.thresholds.default.yellowThreshold !== DEFAULT_THRESHOLDS.default.yellowThreshold ||
    existing.thresholds.default.redThreshold !== DEFAULT_THRESHOLDS.default.redThreshold ||
    existing.enabledModules.join(',') !== DEFAULT_ENABLED_MODULES.join(',')

  if (!hasExisting) {
    if (legacy.llm) {
      await persistLlmToTauri(legacy.llm)
    }

    const hasLegacyThresholds =
      legacy.thresholds.default.yellowThreshold !== DEFAULT_THRESHOLDS.default.yellowThreshold ||
      legacy.thresholds.default.redThreshold !== DEFAULT_THRESHOLDS.default.redThreshold
    if (hasLegacyThresholds) {
      await persistThresholdsToTauri(legacy.thresholds)
    }

    const hasLegacyModules = legacy.enabledModules.join(',') !== DEFAULT_ENABLED_MODULES.join(',')
    if (hasLegacyModules) {
      await persistEnabledModulesToTauri(legacy.enabledModules)
    }
  }

  const snapshot = hasExisting
    ? existing
    : {
        llm: legacy.llm,
        thresholds: legacy.thresholds,
        enabledModules: legacy.enabledModules,
      }

  settingsState = cloneSnapshot(snapshot)
  removeLegacyBrowserKeys()
}

function hydrateFromBrowser() {
  settingsState = cloneSnapshot(readLegacyBrowserSnapshot())
}

export async function initializeSettingsStore() {
  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    try {
      if (isTauriRuntime()) {
        await hydrateFromTauri()
      } else {
        hydrateFromBrowser()
      }
    } finally {
      emitSettingsSnapshot()
    }
  })()

  return initializationPromise
}

export function getSettingsSnapshot() {
  return cloneSnapshot(settingsState)
}

export function subscribeSettingsSnapshot(listener: (snapshot: StoredSettingsSnapshot) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function saveStoredLLMSettings(next: StoredLLMSettings | null) {
  if (isTauriRuntime()) {
    await persistLlmToTauri(next)
  } else if (typeof window !== 'undefined') {
    if (!next) {
      window.localStorage.removeItem(LLM_STORAGE_KEY)
      window.sessionStorage.removeItem(LLM_SECRET_STORAGE_KEY)
    } else {
      const localValue = {
        provider: next.provider,
        providers: Object.fromEntries(
          Object.entries(next.providers).map(([provider, settings]) => [
            provider,
            settings
              ? {
                  apiUrl: settings.apiUrl,
                  model: settings.model,
                }
              : settings,
          ]),
        ),
      }
      window.localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(localValue))
      const active = next.providers[next.provider]
      if (active) {
        window.sessionStorage.setItem(LLM_SECRET_STORAGE_KEY, JSON.stringify({
          provider: next.provider,
          apiKey: active.apiKey,
        }))
      }
    }
  }

  settingsState = {
    ...settingsState,
    llm: next ? cloneSnapshot({ ...settingsState, llm: next }).llm : null,
  }
  emitSettingsSnapshot()
}

export async function saveStoredThresholdSettings(next: ThresholdSettings) {
  if (isTauriRuntime()) {
    await persistThresholdsToTauri(next)
  } else if (typeof window !== 'undefined') {
    window.localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify(next))
  }

  settingsState = {
    ...settingsState,
    thresholds: { default: { ...next.default } },
  }
  emitSettingsSnapshot()
}

export async function resetStoredThresholdSettings() {
  if (isTauriRuntime()) {
    await invokeTauri('settings_reset_threshold_settings')
  } else if (typeof window !== 'undefined') {
    window.localStorage.removeItem(THRESHOLD_STORAGE_KEY)
  }

  settingsState = {
    ...settingsState,
    thresholds: { default: { ...DEFAULT_THRESHOLDS.default } },
  }
  emitSettingsSnapshot()
}

export async function saveStoredEnabledModules(moduleIds: string[]) {
  if (isTauriRuntime()) {
    await persistEnabledModulesToTauri(moduleIds)
  } else if (typeof window !== 'undefined') {
    window.localStorage.setItem(ENABLED_MODULES_KEY, JSON.stringify(moduleIds))
  }

  settingsState = {
    ...settingsState,
    enabledModules: [...moduleIds],
  }
  emitSettingsSnapshot()
}
