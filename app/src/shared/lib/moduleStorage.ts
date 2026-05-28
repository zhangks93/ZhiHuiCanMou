import {
  DEFAULT_ENABLED_MODULES,
  getSettingsSnapshot,
  saveStoredEnabledModules,
  subscribeSettingsSnapshot,
} from '@/shared/lib/settingsStore'

export function getEnabledModules(): string[] {
  try {
    return getSettingsSnapshot().enabledModules
  } catch (e) {
    console.error('Failed to load enabled modules:', e)
  }
  return [...DEFAULT_ENABLED_MODULES]
}

export async function saveEnabledModules(moduleIds: string[]): Promise<void> {
  try {
    await saveStoredEnabledModules(moduleIds)
  } catch (e) {
    console.error('Failed to save enabled modules:', e)
    throw e
  }
}

export function subscribeEnabledModules(listener: (moduleIds: string[]) => void): () => void {
  return subscribeSettingsSnapshot((snapshot) => listener(snapshot.enabledModules))
}
