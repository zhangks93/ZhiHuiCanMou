import { createBrowserStore } from '@/shared/storage/createBrowserStore'

const ENABLED_MODULES_KEY = 'canmou_enabled_modules'

const DEFAULT_ENABLED_MODULES = [
  'schedule',
  'org-data',
  'biz-data',
  'opportunity',
  'competitor',
  'trip',
  'attendance',
  'links',
  'ai',
]

const enabledModulesStore = createBrowserStore<string[]>({
  key: ENABLED_MODULES_KEY,
  fallback: () => [...DEFAULT_ENABLED_MODULES],
  deserialize: (raw) => {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  },
})

export function getEnabledModules(): string[] {
  try {
    return enabledModulesStore.get()
  } catch (e) {
    console.error('Failed to load enabled modules:', e)
  }
  return [...DEFAULT_ENABLED_MODULES]
}

export function saveEnabledModules(moduleIds: string[]): void {
  try {
    enabledModulesStore.set(moduleIds)
  } catch (e) {
    console.error('Failed to save enabled modules:', e)
  }
}

export function subscribeEnabledModules(listener: (moduleIds: string[]) => void): () => void {
  return enabledModulesStore.subscribe(listener)
}
