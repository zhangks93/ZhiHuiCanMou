import { supabase, type MetricCategory } from '@/shared/lib/supabase'
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

function getSchoolYearInfo(): { schoolYear: number; monthIndex: number } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  // School year starts in July: Jul=month 1, Jun=month 12
  if (month >= 7) {
    return { schoolYear: year, monthIndex: month - 6 }
  } else {
    return { schoolYear: year - 1, monthIndex: month + 6 }
  }
}

function sortPeriodsDesc(values: string[]): string[] {
  return [...values].sort((a, b) => b.localeCompare(a))
}

async function fetchDistinctValues(
  table: 'edu_biz_report' | 'edu_biz_monthly_plan',
  column: 'period' | 'month' | 'sheet_code'
): Promise<string[]> {
  const PAGE_SIZE = 1000
  const values = new Set<string>()
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) throw error

    const pageData = (data ?? []) as unknown as Array<Record<string, unknown>>
    pageData.forEach((row: Record<string, unknown>) => {
      const value = row[column]
      if (typeof value === 'string' && value) {
        values.add(value)
      }
    })

    hasMore = pageData.length === PAGE_SIZE
    page += 1
  }

  return [...values]
}

async function fetchPeriods(periodType: 'monthly' | 'cumulative'): Promise<string[]> {
  const PAGE_SIZE = 1000
  const values = new Set<string>()
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('edu_biz_report')
      .select('period')
      .eq('period_type', periodType)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) throw new Error(`加载 ${periodType} 期间失败: ${error.message}`)

    const pageData = data ?? []
    pageData.forEach((row: Record<string, unknown>) => {
      const period = row.period
      if (typeof period === 'string' && period) {
        values.add(period)
      }
    })

    hasMore = pageData.length === PAGE_SIZE
    page += 1
  }

  return sortPeriodsDesc([...values])
}

async function fetchMonthlyPlanMonths(): Promise<string[]> {
  try {
    return sortPeriodsDesc(await fetchDistinctValues('edu_biz_monthly_plan', 'month'))
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`加载月度计划月份失败: ${error.message}`)
    }
    throw error
  }
}

async function fetchOrgLevel1(): Promise<string[]> {
  const { data, error } = await supabase
    .from('edu_org_hierarchy')
    .select('level_1')
    .not('level_1', 'is', null)

  if (error) return []

  return Array.from(
    new Set((data || []).map(row => row.level_1).filter((v): v is string => Boolean(v)))
  ).sort()
}

const SHEET_CODE_LABELS: Record<string, string> = {
  '1.1': '主报表-收入利润(fone)',
  '1.2': '主报表-收入利润(tuwei)',
  '2.1': '主报表-人效指标(fone)',
  '2.2': '主报表-人效指标(tuwei)',
  '2.3': '主报表-补充指标',
  '6.1': '成本分析-人力成本明细(fone)',
  '6.2': '成本分析-人力成本明细(tuwei)',
  '7.1': '成本分析-费用明细(fone)',
  '7.2': '成本分析-费用明细(tuwei)',
}

async function fetchSheetCodes(): Promise<{ code: string; label: string }[]> {
  let codes: string[] = []
  try {
    codes = (await fetchDistinctValues('edu_biz_report', 'sheet_code')).sort()
  } catch {
    return []
  }

  return codes.map(code => ({ code, label: SHEET_CODE_LABELS[code] || code }))
}

async function buildRuntimeDataContext(): Promise<FinancialAnalysisRuntimeDataContext> {
  const [monthlyPeriods, cumulativePeriods, monthlyPlanMonths, orgLevel1, sheetCodes] = await Promise.all([
    fetchPeriods('monthly'),
    fetchPeriods('cumulative'),
    fetchMonthlyPlanMonths(),
    fetchOrgLevel1(),
    fetchSheetCodes(),
  ])

  return {
    latestMonthlyPeriod: monthlyPeriods[0],
    latestCumulativePeriod: cumulativePeriods[0],
    monthlyPeriods,
    cumulativePeriods,
    monthlyPlanMonths,
    reportTypes: ['fone', 'tuwei'],
    metrics: Object.entries(METRIC_LABELS).map(([key, label]) => ({ key, label })),
    orgLevel1,
    sheetCodes,
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
    .map(metric => `${metric.key}${metric.label ? `(${metric.label})` : ''}`)
    .join(', ')

  const { schoolYear, monthIndex } = getSchoolYearInfo()

  return [
    '## Runtime Data Context',
    `- current_school_year: ${schoolYear}学年（${schoolYear}年7月-${schoolYear + 1}年6月）`,
    `- current_month_in_school_year: 第${monthIndex}个月`,
    `- latest_monthly_period: ${dataContext.latestMonthlyPeriod || 'unknown'}`,
    `- latest_cumulative_period: ${dataContext.latestCumulativePeriod || 'unknown'}`,
    `- monthly_periods: ${dataContext.monthlyPeriods.join(', ') || 'none'}`,
    `- cumulative_periods: ${dataContext.cumulativePeriods.join(', ') || 'none'}`,
    `- monthly_plan_months: ${dataContext.monthlyPlanMonths.join(', ') || 'none'}`,
    `- report_types: ${dataContext.reportTypes.join(', ')}`,
    `- sheet_codes: ${dataContext.sheetCodes.map(item => `${item.code}(${item.label})`).join(', ') || 'none'}`,
    `- org_level_1: ${dataContext.orgLevel1.join(', ') || 'none'}`,
    `- metrics_preview: ${metricPreview}`,
    '- data_available: revenue, gross_profit, gross_margin, pretax_profit, pretax_margin, labor_cost with detail breakdown, expense structure, headcount, per_capita_revenue, labor_cost_rate, revenue_creation, profit_creation, budget value, completion_rate, diff, year_over_year, monthly_plan',
    '- data_not_available: 回款/应收, 合同签约/在手订单, 项目进度, 全年预测, 责任人/完成时点',
    '- guidance: use only listed period/month values exactly as provided in runtime context; for cumulative queries do not invent next-month periods and do not assume a formula if the runtime list does not contain it. Prefer query_with_hierarchy and treat its returned tree as the primary analysis structure: query a specific node to get its full subtree, or use node_name="" to get the full tree. Analyze parent-child relations directly from tree/children instead of flattening first. In analysis, use returned target_value/completion_rate/diff/yoy fields explicitly and compute rollups, ratios, MoM/YoY deltas, contribution shares, and other derivable values before writing the report. If yoy is already returned, treat it as the prior-period comparison value and do not query the same metric again by moving the month back one year unless yoy is missing and the user explicitly asks for backfill. Do not repeat an identical tool call once a result has already been returned; reuse the existing result and continue analysis. For whole-group analysis, start from the returned top levels and only drill down when a real analysis need remains. Bind every completion_rate/diff/yoy/judgement to either monthly or cumulative scope explicitly, and split monthly vs cumulative sections when both are discussed. In full analysis/report mode, include both labor cost and available expense details such as catering_expense, material_cost, vehicle_expense, energy_expense, travel_expense, entertainment_expense, and other_expense by default unless the user clearly asks for a narrower scope. In report mode, charts must be delivered as structured chart spec JSON, not HTML, and only when the data supports them. When a full chapter lacks data support, skip it with a one-line note instead of outputting empty tables.',
  ].join('\n')
}
