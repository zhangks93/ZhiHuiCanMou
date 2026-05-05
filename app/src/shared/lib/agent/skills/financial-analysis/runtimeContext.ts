import { supabase, type MetricCategory } from '@/shared/lib/supabase'
import type { FinancialAnalysisRuntimeDataContext } from '../../types'
import { getErrorMessage } from '@/shared/lib/errorMessage'

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

    if (error) throw new Error(`${table}.${column} 加载失败: ${getErrorMessage(error, '未知数据库错误')}`)

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
    throw new Error(`加载月度计划月份失败: ${getErrorMessage(error, '未知数据库错误')}`)
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
  '1.1': '主报表-累计（学年预算）',
  '1.2': '主报表-进度（学年预算）',
  '1.3': '主报表-2月（学年预算）',
  '1.4': '主报表-3月（学年预算）',
  '2.1': '主报表-累计（突围考核）',
  '2.2': '主报表-1月（突围考核）',
  '2.3': '主报表-2月（突围考核）',
  '2.4': '主报表-3月（突围考核）',
  '3.1': '成本分析-累计（突围考核）',
  '3.2': '成本分析-2月（突围考核）',
  '3.3': '成本分析-3月（突围考核）',
  '4.1': '成本分析-累计（学年预算）',
  '4.2': '成本分析-2月（学年预算）',
  '4.3': '成本分析-3月（学年预算）',
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
    `- report_types: ${dataContext.reportTypes.join(', ')} (内部口径枚举，仅用于工具参数；终稿只能写学年预算、突围考核)`,
    `- sheet_codes: ${dataContext.sheetCodes.map(item => `${item.code}(${item.label})`).join(', ') || 'none'}`,
    `- org_level_1: ${dataContext.orgLevel1.join(', ') || 'none'}`,
    `- metrics_preview: ${metricPreview}`,
    '- data_available: 核心经营指标、利润率、人力成本及明细、可用费用指标、人效指标、目标值、完成率、差额、同比、月度计划',
    '- data_manual_required: 应收账款回款情况, 资金计划执行情况, 核心费用专项明细',
    '- data_not_available: 合同签约/在手订单, 项目进度, 全年预测, 责任人/完成时点',
    '- guidance: 只能使用上下文列出的合法期间；累计期间不能自行推导不存在的值。完整报告优先使用报告包和写作素材，表格优先使用目标对标宽表、学年目标表、两层组织表和成本费用宽表。不得编造应收、资金计划或专项费用明细，只能在结尾说明补数限制。轻量查数和非报告分析优先使用层级查询结果，直接分析返回的树形父子关系。分析中必须使用返回的实际值、目标值、完成率、差额、同比，并在写作前计算可推导的汇总、占比、环比、同比和贡献。完整报告必须区分当月、截至当月累计和学年目标累计；当月实际值可合并，累计实际值必须按学年预算和突围考核分别展示。完整报告必须至少下钻两层组织并给出具体数字。终稿的标题、正文、表头、预警和说明只能使用中文，不得出现英文、内部字段名、工具字段名、数据表名或内部口径枚举。',
  ].join('\n')
}
