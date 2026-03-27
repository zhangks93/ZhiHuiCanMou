import { supabase, type MetricCategory } from '@/lib/supabase'
import type { FinancialAnalysisRuntimeDataContext } from '../../types'

const CACHE_TTL_MS = 5 * 60 * 1000

const METRIC_LABELS: Record<MetricCategory, string> = {
  revenue: '营业收入',
  gross_profit: '毛利额',
  gross_margin: '毛利率',
  pretax_profit: '税前利润',
  pretax_margin: '税前利润率',
  catering_expense: '餐饮支出',
  material_cost: '物资销售成本',
  other_expense: '其他支出',
  external_expense: '营业外支出',
  labor_cost: '人力成本',
  salary: '工资',
  social_insurance: '社保',
  housing_fund: '公积金',
  labor_service_fee: '劳务费',
  other_labor_cost: '其他人力成本',
  vehicle_expense: '车辆费用',
  energy_expense: '能耗费',
  travel_expense: '差旅费',
  entertainment_expense: '业务招待费',
  external_revenue: '营业外收入',
  headcount: '职工人数',
  per_capita_revenue: '人均营收',
  labor_cost_rate: '人力成本率',
  revenue_creation: '一元创收',
  profit_creation: '一元创利',
}

let cachedContext: FinancialAnalysisRuntimeDataContext | null = null
let cachedAt = 0
let pendingPromise: Promise<FinancialAnalysisRuntimeDataContext> | null = null

function sortPeriodsDesc(values: string[]): string[] {
  return [...values].sort((a, b) => b.localeCompare(a))
}

async function fetchPeriods(periodType: 'monthly' | 'cumulative'): Promise<string[]> {
  const { data, error } = await supabase
    .from('edu_biz_report')
    .select('period')
    .eq('period_type', periodType)
    .limit(500)

  if (error) throw new Error(`加载 ${periodType} 期间失败: ${error.message}`)

  const periods = Array.from(
    new Set((data || []).map(row => row.period).filter((period): period is string => Boolean(period)))
  )

  return sortPeriodsDesc(periods)
}

async function fetchMonthlyPlanMonths(): Promise<string[]> {
  const { data, error } = await supabase
    .from('edu_biz_monthly_plan')
    .select('month')
    .limit(200)

  if (error) throw new Error(`加载月度计划月份失败: ${error.message}`)

  const months = Array.from(
    new Set((data || []).map(row => row.month).filter((month): month is string => Boolean(month)))
  )

  return sortPeriodsDesc(months)
}

async function buildRuntimeDataContext(): Promise<FinancialAnalysisRuntimeDataContext> {
  const [monthlyPeriods, cumulativePeriods, monthlyPlanMonths] = await Promise.all([
    fetchPeriods('monthly'),
    fetchPeriods('cumulative'),
    fetchMonthlyPlanMonths(),
  ])

  return {
    latestMonthlyPeriod: monthlyPeriods[0],
    latestCumulativePeriod: cumulativePeriods[0],
    monthlyPeriods,
    cumulativePeriods,
    monthlyPlanMonths,
    reportTypes: ['fone', 'tuwei'],
    metrics: Object.entries(METRIC_LABELS).map(([key, label]) => ({ key, label })),
    fetchedAt: Date.now(),
  }
}

export async function getFinancialAnalysisRuntimeDataContext(): Promise<FinancialAnalysisRuntimeDataContext> {
  const now = Date.now()
  if (cachedContext && now - cachedAt < CACHE_TTL_MS) {
    return cachedContext
  }

  if (!pendingPromise) {
    pendingPromise = buildRuntimeDataContext()
      .then((context) => {
        cachedContext = context
        cachedAt = Date.now()
        return context
      })
      .finally(() => {
        pendingPromise = null
      })
  }

  return pendingPromise
}

export function buildFinancialAnalysisRuntimeContextBlock(
  dataContext?: FinancialAnalysisRuntimeDataContext
): string {
  if (!dataContext) return ''

  const metricPreview = dataContext.metrics
    .slice(0, 12)
    .map(metric => `${metric.key}${metric.label ? `(${metric.label})` : ''}`)
    .join(', ')

  return [
    '## Runtime Data Context',
    `- latest_monthly_period: ${dataContext.latestMonthlyPeriod || 'unknown'}`,
    `- latest_cumulative_period: ${dataContext.latestCumulativePeriod || 'unknown'}`,
    `- monthly_periods: ${dataContext.monthlyPeriods.join(', ') || 'none'}`,
    `- cumulative_periods: ${dataContext.cumulativePeriods.join(', ') || 'none'}`,
    `- monthly_plan_months: ${dataContext.monthlyPlanMonths.join(', ') || 'none'}`,
    `- report_types: ${dataContext.reportTypes.join(', ')}`,
    `- metrics_preview: ${metricPreview}`,
    '- guidance: use only listed period/month values; prefer query_with_hierarchy; use read_file only for explicit report requests; in report mode, charts must be fenced `html` code blocks and never placeholder suggestions.',
  ].join('\n')
}
