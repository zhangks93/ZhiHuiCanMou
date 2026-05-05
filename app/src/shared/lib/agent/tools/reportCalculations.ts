import type { MetricCategory } from '@/features/biz-data/types'
import type { GoalProbability, GoalRiskLevel, ReportStatus } from './reportPackTypes'

export const DEFAULT_REPORT_METRICS: MetricCategory[] = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'pretax_profit',
  'pretax_margin',
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
  'vehicle_expense',
  'energy_expense',
  'travel_expense',
  'entertainment_expense',
  'external_revenue',
  'headcount',
  'per_capita_revenue',
  'labor_cost_rate',
  'revenue_creation',
  'profit_creation',
]

export const LOWER_IS_BETTER_METRICS = new Set<MetricCategory>([
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
  'vehicle_expense',
  'energy_expense',
  'travel_expense',
  'entertainment_expense',
])

export function inferPreviousMonth(month: string): string {
  const match = /^(\d{4})(\d{2})$/.exec(month)
  if (!match) return month

  const year = Number(match[1])
  const monthNo = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12) {
    return month
  }

  const previous = new Date(year, monthNo - 2, 1)
  return `${previous.getFullYear()}${String(previous.getMonth() + 1).padStart(2, '0')}`
}

export function inferCumulativeToMonthPeriod(month: string): string {
  const match = /^(\d{4})(\d{2})$/.exec(month)
  if (!match) return month

  const year = Number(match[1])
  const monthNo = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12) {
    return month
  }

  const next = new Date(year, monthNo, 1)
  return `<${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function inferSchoolYearTargetPeriod(month: string): string {
  const match = /^(\d{4})(\d{2})$/.exec(month)
  if (!match) return month

  const year = Number(match[1])
  const monthNo = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12) {
    return month
  }

  const schoolYearEndYear = monthNo >= 7 ? year + 1 : year
  return `<${schoolYearEndYear}07`
}

export function schoolYearProgressRate(month: string): number {
  const match = /^(\d{4})(\d{2})$/.exec(month)
  if (!match) return 1

  const monthNo = Number(match[2])
  if (!Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12) {
    return 1
  }

  const schoolYearMonthIndex = monthNo >= 7 ? monthNo - 6 : monthNo + 6
  return schoolYearMonthIndex / 12
}

export function assessGoalProbability(params: {
  completionRate: number | null
  progressRate: number
  actual: number | null
  metric: 'revenue' | 'pretax_profit'
}): { probability: GoalProbability; risk: GoalRiskLevel; progressGap: number | null } {
  if (params.completionRate == null || !Number.isFinite(params.completionRate)) {
    return { probability: '数据不足', risk: '需补数', progressGap: null }
  }

  const progressGap = params.completionRate - params.progressRate
  let probability: GoalProbability
  let risk: GoalRiskLevel

  if (params.completionRate >= 1) {
    probability = '已达成'
    risk = '低'
  } else if (progressGap >= 0.05) {
    probability = '较高'
    risk = '低'
  } else if (progressGap >= -0.05) {
    probability = '中等'
    risk = '中'
  } else {
    probability = '较低'
    risk = '高'
  }

  if (params.metric === 'pretax_profit' && (params.actual ?? 0) < 0) {
    risk = '高'
    if (probability !== '已达成') probability = '较低'
  }

  return { probability, risk, progressGap }
}

export function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function diff(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null) return null
  return actual - target
}

export function completion(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || target === 0) return null
  return actual / target
}

export function contributionShare(value: number | null, total: number | null): number | null {
  if (value == null || total == null || total === 0) return null
  return value / total
}

export function statusByCompletion(rate: number | null, lowerIsBetter = false): ReportStatus {
  if (rate == null) return 'missing'
  if (lowerIsBetter) {
    if (rate <= 1) return 'good'
    if (rate <= 1.1) return 'watch'
    return 'risk'
  }
  if (rate >= 0.95) return 'good'
  if (rate >= 0.8) return 'watch'
  return 'risk'
}

export function formatPctForJudgement(rate: number | null): string {
  if (rate == null) return '无数据'
  return `${(rate * 100).toFixed(0)}%`
}
