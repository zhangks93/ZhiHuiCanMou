import { supabase } from '@/lib/supabase'
import type {
  EduBizReport,
  EduBizMonthlyPlan,
  BizDataNode,
} from '@/lib/supabase'

// --- Query Options ---
export interface BizDataQueryOptions {
  period?: string  // e.g., "<202603"
  periodType?: 'cumulative' | 'monthly'
  reportTypes?: ('fone' | 'tuwei')[]
  sheetCodes?: string[]
  centerRegion?: string
  businessSegment?: string
}

// --- Fetch Functions ---

/**
 * 获取经营数据报表
 * Note: Different report_types may have different period formats for the same logical period
 * e.g., cumulative fone uses '<202603', tuwei uses '202601-202602-'
 */
export async function fetchBizReport(options: BizDataQueryOptions = {}) {
  const {
    period,
    periodType = 'cumulative',
    reportTypes = ['fone', 'tuwei'],
    sheetCodes,
    centerRegion,
    businessSegment,
  } = options

  console.log('[fetchBizReport] Options:', { period, periodType, reportTypes })

  let query = supabase
    .from('edu_biz_report')
    .select('*')
    .eq('period_type', periodType)
    .order('sort_order')

  // Don't filter by period if not specified - fetch all periods for this period_type
  // This allows us to handle different period formats for fone vs tuwei
  if (period) {
    query = query.eq('period', period)
  }

  if (reportTypes.length > 0) {
    query = query.in('report_type', reportTypes)
  }

  if (sheetCodes && sheetCodes.length > 0) {
    query = query.in('sheet_code', sheetCodes)
  }

  if (centerRegion) {
    query = query.eq('center_region', centerRegion)
  }

  if (businessSegment) {
    query = query.eq('business_segment', businessSegment)
  }

  const { data, error } = await query

  if (error) {
    console.error('[fetchBizReport] Error:', error)
    throw error
  }

  console.log('[fetchBizReport] Fetched rows:', data?.length ?? 0)
  return (data ?? []) as EduBizReport[]
}

/**
 * 获取月度突围计划
 */
export async function fetchMonthlyPlan(options: { centerRegion?: string; businessSegment?: string } = {}) {
  const { centerRegion, businessSegment } = options

  let query = supabase
    .from('edu_biz_monthly_plan')
    .select('*')
    .order('sort_order')

  if (centerRegion) {
    query = query.eq('center_region', centerRegion)
  }

  if (businessSegment) {
    query = query.eq('business_segment', businessSegment)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch monthly plan:', error)
    throw error
  }

  return (data ?? []) as EduBizMonthlyPlan[]
}

/**
 * 获取可用的期间列表
 */
export async function fetchAvailablePeriods() {
  const { data, error } = await supabase
    .from('edu_biz_report')
    .select('period, period_type, report_type')
    .order('period', { ascending: false })

  if (error) {
    console.error('Failed to fetch periods:', error)
    return []
  }

  console.log('[fetchAvailablePeriods] Raw data:', data)

  // Group by period_type and find representative periods
  // For cumulative: use fone period as primary (e.g., <202603)
  // For monthly: collect all unique month periods
  const periodMap = new Map<string, { period_type: 'cumulative' | 'monthly'; periods: Set<string> }>()

  data?.forEach(d => {
    const key = d.period_type
    if (!periodMap.has(key)) {
      periodMap.set(key, { period_type: d.period_type as 'cumulative' | 'monthly', periods: new Set() })
    }
    periodMap.get(key)!.periods.add(d.period)
  })

  const result: Array<{ period_type: 'cumulative' | 'monthly'; period: string; label: string }> = []

  periodMap.forEach((value) => {
    const periods = Array.from(value.periods).sort().reverse()
    periods.forEach(period => {
      result.push({
        period_type: value.period_type,
        period,
        label: value.period_type === 'cumulative'
          ? `累计 ${period.replace('<', '').replace('-', '至')}`
          : `月度 ${period}`
      })
    })
  })

  console.log('[fetchAvailablePeriods] Processed periods:', result)
  return result
}

// --- Aggregation Functions ---

/**
 * 按节点聚合数据（合并 fone 和 tuwei）
 */
export function aggregateByNode(
  foneReports: EduBizReport[],
  tuweiReports: EduBizReport[],
  monthlyPlans: EduBizMonthlyPlan[]
): BizDataNode[] {
  console.log('[aggregateByNode] Input:', {
    foneReports: foneReports.length,
    tuweiReports: tuweiReports.length,
    monthlyPlans: monthlyPlans.length
  })

  const nodeMap = new Map<string, BizDataNode>()

  // 处理 fone 数据
  for (const row of foneReports) {
    if (!nodeMap.has(row.node_name)) {
      nodeMap.set(row.node_name, createEmptyNode(row))
    }
    const node = nodeMap.get(row.node_name)!
    if (!node.metrics[row.metric_category]) {
      node.metrics[row.metric_category] = {
        actual: null,
        budget_fone: null,
        budget_tuwei: null,
        completion_fone: null,
        completion_tuwei: null,
        diff_fone: null,
        diff_tuwei: null,
        yoy: null,
      }
    }
    const metric = node.metrics[row.metric_category]!
    metric.actual = row.actual_value
    metric.budget_fone = row.budget_value
    metric.completion_fone = row.completion_rate
    metric.diff_fone = row.diff_value
    metric.yoy = row.yoy_value
  }

  // 处理 tuwei 数据
  for (const row of tuweiReports) {
    if (!nodeMap.has(row.node_name)) {
      // If node doesn't exist from fone data, create it from tuwei
      nodeMap.set(row.node_name, createEmptyNode(row))
    }
    const node = nodeMap.get(row.node_name)!
    if (!node.metrics[row.metric_category]) {
      node.metrics[row.metric_category] = {
        actual: null,
        budget_fone: null,
        budget_tuwei: null,
        completion_fone: null,
        completion_tuwei: null,
        diff_fone: null,
        diff_tuwei: null,
        yoy: null,
      }
    }
    const metric = node.metrics[row.metric_category]!
    // If actual is not set from fone, use tuwei's actual
    if (metric.actual === null) {
      metric.actual = row.actual_value
    }
    metric.budget_tuwei = row.budget_value
    metric.completion_tuwei = row.completion_rate
    metric.diff_tuwei = row.diff_value
    // If yoy is not set from fone, use tuwei's yoy
    if (metric.yoy === null) {
      metric.yoy = row.yoy_value
    }
  }

  // 处理月度计划
  for (const plan of monthlyPlans) {
    const node = nodeMap.get(plan.node_name)
    if (node && node.metrics[plan.metric_category]) {
      const metric = node.metrics[plan.metric_category]!
      if (!metric.monthly_plan) {
        metric.monthly_plan = {}
      }
      metric.monthly_plan[plan.month] = plan.plan_value ?? 0
    }
  }

  const result = Array.from(nodeMap.values()).sort((a, b) => a.sort_order - b.sort_order)
  console.log('[aggregateByNode] Output nodes:', result.length)
  return result
}

/**
 * 创建空节点
 */
function createEmptyNode(row: EduBizReport | EduBizMonthlyPlan): BizDataNode {
  return {
    node_name: row.node_name,
    sort_order: row.sort_order,
    hierarchy: {
      center_region: row.center_region,
      business_segment: row.business_segment,
      report_level1: row.report_level1,
      report_level2: row.report_level2,
      is_aggregated: row.is_aggregated,
      aggregation_level: row.aggregation_level,
    },
    metrics: {},
  }
}

// --- Hierarchy Tree Building ---

export interface HierarchyTree {
  total: BizDataNode[]
  centers: BizDataNode[]
  segments: BizDataNode[]
  level1: BizDataNode[]
  level2: BizDataNode[]
  leafNodes: BizDataNode[]
}

/**
 * 构建层级树
 */
export function buildHierarchyTree(nodes: BizDataNode[]): HierarchyTree {
  const total = nodes.filter(n => n.hierarchy.is_aggregated && n.hierarchy.aggregation_level === 'total')
  const centers = nodes.filter(n => n.hierarchy.center_region && !n.hierarchy.business_segment && !n.hierarchy.is_aggregated)
  const segments = nodes.filter(n => n.hierarchy.business_segment && !n.hierarchy.report_level1 && !n.hierarchy.is_aggregated)
  const level1 = nodes.filter(n => n.hierarchy.report_level1 && !n.hierarchy.report_level2 && !n.hierarchy.is_aggregated)
  const level2 = nodes.filter(n => n.hierarchy.report_level2 && !n.hierarchy.is_aggregated)
  const leafNodes = nodes.filter(n => !n.hierarchy.is_aggregated)

  return {
    total,
    centers,
    segments,
    level1,
    level2,
    leafNodes,
  }
}

/**
 * 获取子节点
 */
export function getChildren(parentNode: BizDataNode, allNodes: BizDataNode[]): BizDataNode[] {
  const { center_region, business_segment, report_level1 } = parentNode.hierarchy

  // 如果是中心节点，返回其下的板块
  if (center_region && !business_segment) {
    return allNodes.filter(n =>
      n.hierarchy.center_region === center_region &&
      n.hierarchy.business_segment &&
      !n.hierarchy.report_level1 &&
      !n.hierarchy.is_aggregated
    )
  }

  // 如果是板块节点，返回其下的一级单元
  if (business_segment && !report_level1) {
    return allNodes.filter(n =>
      n.hierarchy.business_segment === business_segment &&
      n.hierarchy.report_level1 &&
      !n.hierarchy.report_level2 &&
      !n.hierarchy.is_aggregated
    )
  }

  // 如果是一级单元，返回其下的二级单元
  if (report_level1) {
    return allNodes.filter(n =>
      n.hierarchy.report_level1 === report_level1 &&
      n.hierarchy.report_level2 &&
      !n.hierarchy.is_aggregated
    )
  }

  return []
}

// --- Calculation Helpers ---

/**
 * 安全计算完成率
 */
export function safeCompletionRate(actual: number | null, budget: number | null): number | null {
  if (actual == null || budget == null || budget === 0) return null
  return actual / budget
}

/**
 * 安全计算差异
 */
export function safeDiff(actual: number | null, budget: number | null): number | null {
  if (actual == null || budget == null) return null
  return actual - budget
}
