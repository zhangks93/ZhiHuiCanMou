import {
  DEFAULT_THRESHOLDS,
  getSettingsSnapshot,
  resetStoredThresholdSettings,
  saveStoredThresholdSettings,
  subscribeSettingsSnapshot,
  type ThresholdConfig,
  type ThresholdSettings,
} from '@/shared/lib/settingsStore'
import type { MetricCategory } from '@/shared/lib/supabase'

export { DEFAULT_THRESHOLDS }
export type { ThresholdConfig, ThresholdSettings } from '@/shared/lib/settingsStore'

// 预警阈值配置管理

const LOWER_IS_BETTER_METRICS = new Set<MetricCategory>([
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'vehicle_expense',
  'energy_expense',
  'travel_expense',
  'entertainment_expense',
  'headcount',
  'labor_cost_rate',
])

// 加载阈值配置
export function loadThresholdSettings(): ThresholdSettings {
  try {
    return getSettingsSnapshot().thresholds
  } catch (error) {
    console.error('[ThresholdConfig] Failed to load settings:', error)
  }
  return DEFAULT_THRESHOLDS
}

// 保存阈值配置
export async function saveThresholdSettings(settings: ThresholdSettings): Promise<void> {
  try {
    await saveStoredThresholdSettings(settings)
  } catch (error) {
    console.error('[ThresholdConfig] Failed to save settings:', error)
    throw error
  }
}

// 重置为默认阈值
export async function resetThresholdSettings(): Promise<void> {
  await resetStoredThresholdSettings()
}

export function subscribeThresholdSettings(
  listener: (settings: ThresholdSettings) => void,
): () => void {
  return subscribeSettingsSnapshot((snapshot) => listener(snapshot.thresholds))
}

// 获取节点的预警阈值（统一使用默认阈值）
export function getNodeThresholds(): ThresholdConfig {
  const settings = loadThresholdSettings()
  return settings.default
}

export function isLowerBetterMetric(metric: MetricCategory): boolean {
  return LOWER_IS_BETTER_METRICS.has(metric)
}

function normalizeLowerBetterRate(actual: number, budget: number): number {
  if (budget > 0) {
    if (actual <= 0) return 1
    return budget / actual
  }

  if (budget < 0) {
    if (actual === 0) return 1
    return actual / budget
  }

  return 1
}

function normalizeHigherBetterRate(actual: number, budget: number, rawCompletionRate?: number | null): number {
  if (budget > 0) {
    return rawCompletionRate ?? (actual / budget)
  }

  if (budget < 0) {
    if (actual >= 0) return 1
    return budget / actual
  }

  return 1
}

export function getMetricDisplayCompletionRate(
  metric: MetricCategory,
  actual: number | null | undefined,
  budget: number | null | undefined,
  rawCompletionRate?: number | null,
): number | null {
  if (actual == null || budget == null || budget === 0) return rawCompletionRate ?? null

  if (isLowerBetterMetric(metric)) {
    return normalizeLowerBetterRate(actual, budget)
  }

  return normalizeHigherBetterRate(actual, budget, rawCompletionRate)
}

export function getMetricAlertRuleText(
  metric: MetricCategory,
  budget: number | null | undefined,
): string | null {
  if (budget == null) return null

  if (isLowerBetterMetric(metric)) {
    return '该指标按“越低越好”评估，显示为控制达成率。'
  }

  if (budget < 0) {
    return '该指标目标为负值，按“亏损收窄/由负转正更优”评估。'
  }

  return null
}

export function getAlertLevelByMetric(
  metric: MetricCategory,
  actual: number | null | undefined,
  budget: number | null | undefined,
  rawCompletionRate: number | null | undefined,
  thresholds: ThresholdConfig,
): 'success' | 'warning' | 'danger' | 'none' {
  const completionRate = getMetricDisplayCompletionRate(metric, actual, budget, rawCompletionRate)
  return getAlertLevel(completionRate, thresholds)
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
