const ENABLED_MODULES_KEY = 'canmou_enabled_modules'

export function getEnabledModules(): string[] {
  try {
    const stored = localStorage.getItem(ENABLED_MODULES_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load enabled modules:', e)
  }
  // 默认启用所有模块
  return [
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
}

export function saveEnabledModules(moduleIds: string[]): void {
  try {
    localStorage.setItem(ENABLED_MODULES_KEY, JSON.stringify(moduleIds))
  } catch (e) {
    console.error('Failed to save enabled modules:', e)
  }
}
