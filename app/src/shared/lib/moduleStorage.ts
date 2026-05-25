import { DEFAULT_ENABLED_MODULE_IDS } from '@/app/config/modules'
import { logger } from '@/shared/lib/logger'
import {
  getSettingsSnapshot,
  saveStoredEnabledModules,
  subscribeSettingsSnapshot,
} from '@/shared/lib/settingsStore'

export function getEnabledModules(): string[] {
  try {
    return getSettingsSnapshot().enabledModules
  } catch (e) {
    logger.error('Failed to load enabled modules', e)
  }
  return [...DEFAULT_ENABLED_MODULE_IDS]
}

export async function saveEnabledModules(moduleIds: string[]): Promise<void> {
  try {
    await saveStoredEnabledModules(moduleIds)
  } catch (e) {
    logger.error('Failed to save enabled modules', e)
    throw e
  }
}

export function subscribeEnabledModules(listener: (moduleIds: string[]) => void): () => void {
  return subscribeSettingsSnapshot((snapshot) => listener(snapshot.enabledModules))
}
