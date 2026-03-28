import { createBrowserStore } from '@/shared/storage/createBrowserStore'

// 预警阈值配置管理

export interface ThresholdConfig {
  yellowThreshold: number  // 黄色预警阈值 (0-1)
  redThreshold: number     // 红色预警阈值 (0-1)
}

export interface ThresholdSettings {
  default: ThresholdConfig      // 默认阈值（适用于所有经营数据）
}

const STORAGE_KEY = 'biz_data_threshold_settings'

// 默认阈值配置
export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  default: {
    yellowThreshold: 0.80,  // 80%
    redThreshold: 0.70,     // 70%
  },
}

const thresholdSettingsStore = createBrowserStore<ThresholdSettings>({
  key: STORAGE_KEY,
  fallback: DEFAULT_THRESHOLDS,
  deserialize: (raw) => {
    const parsed = JSON.parse(raw)
    if (
      parsed?.default?.yellowThreshold != null &&
      parsed?.default?.redThreshold != null
    ) {
      return parsed as ThresholdSettings
    }
    return null
  },
})

// 加载阈值配置
export function loadThresholdSettings(): ThresholdSettings {
  try {
    return thresholdSettingsStore.get()
  } catch (error) {
    console.error('[ThresholdConfig] Failed to load settings:', error)
  }
  return DEFAULT_THRESHOLDS
}

// 保存阈值配置
export function saveThresholdSettings(settings: ThresholdSettings): void {
  try {
    thresholdSettingsStore.set(settings)
  } catch (error) {
    console.error('[ThresholdConfig] Failed to save settings:', error)
  }
}

// 重置为默认阈值
export function resetThresholdSettings(): void {
  saveThresholdSettings(DEFAULT_THRESHOLDS)
}

export function subscribeThresholdSettings(
  listener: (settings: ThresholdSettings) => void,
): () => void {
  return thresholdSettingsStore.subscribe(listener)
}

// 获取节点的预警阈值（统一使用默认阈值）
export function getNodeThresholds(): ThresholdConfig {
  const settings = loadThresholdSettings()
  return settings.default
}

// 根据完成率和阈值获取预警级别
export function getAlertLevel(
  completionRate: number | null | undefined,
  thresholds: ThresholdConfig
): 'success' | 'warning' | 'danger' | 'none' {
  if (completionRate == null) return 'none'

  if (completionRate >= thresholds.yellowThreshold) {
    return 'success'
  } else if (completionRate >= thresholds.redThreshold) {
    return 'warning'
  } else {
    return 'danger'
  }
}

// 根据预警级别获取颜色类名
export function getAlertColorClass(level: 'success' | 'warning' | 'danger' | 'none'): string {
  switch (level) {
    case 'success':
      return 'text-success-600'
    case 'warning':
      return 'text-warning-600'
    case 'danger':
      return 'text-error-600'
    default:
      return 'text-gray-400'
  }
}

// 根据预警级别获取背景颜色类名（用于色块）
export function getAlertBgClass(level: 'success' | 'warning' | 'danger' | 'none'): string {
  switch (level) {
    case 'success':
      return 'bg-success-100/80'
    case 'warning':
      return 'bg-warning-100/80'
    case 'danger':
      return 'bg-error-100/80'
    default:
      return 'bg-gray-100/50'
  }
}

// 根据预警级别获取边框颜色类名
export function getAlertBorderClass(level: 'success' | 'warning' | 'danger' | 'none'): string {
  switch (level) {
    case 'success':
      return 'border-success-300'
    case 'warning':
      return 'border-warning-300'
    case 'danger':
      return 'border-error-300'
    default:
      return 'border-gray-200'
  }
}
