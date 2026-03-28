import { supabase } from '@/shared/lib/supabase'
import type {
  EduBizReport,
  EduBizMonthlyPlan,
  EnrichedBizDataNode,
  MetricCategory,
} from '../types'

export interface BizDataQueryOptions {
  period?: string
  periodType?: 'cumulative' | 'monthly'
  reportTypes?: ('fone' | 'tuwei')[]
  sheetCodes?: string[]
}

type NodeMetricValue = NonNullable<EnrichedBizDataNode['metrics'][MetricCategory]>
type NodeKind = 'total' | 'level1' | 'level2' | 'leaf' | 'orphan'

const EMPTY_HIERARCHY = {
  center_region: null,
  business_segment: null,
  report_level1: null,
  report_level2: null,
  is_aggregated: false,
  aggregation_level: null,
} as const

const DERIVED_METRIC_DEPENDENCIES: Partial<Record<MetricCategory, {
  numerator: MetricCategory
  denominator: MetricCategory
}>> = {
  gross_margin: { numerator: 'gross_profit', denominator: 'revenue' },
  pretax_margin: { numerator: 'pretax_profit', denominator: 'revenue' },
  labor_cost_rate: { numerator: 'labor_cost', denominator: 'revenue' },
  per_capita_revenue: { numerator: 'revenue', denominator: 'headcount' },
  revenue_creation: { numerator: 'revenue', denominator: 'labor_cost' },
  profit_creation: { numerator: 'pretax_profit', denominator: 'labor_cost' },
}

const SYNTHETIC_SORT_ORDER = {
  total: 0,
  level1: 100,
  level2: 200,
} as const

function createEmptyMetric(): NodeMetricValue {
  return {
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

function createEmptyNode(row: Pick<EduBizReport, 'node_name' | 'sort_order'> & {
  org_hierarchy?: EduBizReport['org_hierarchy']
}): EnrichedBizDataNode {
  return {
    node_name: row.node_name,
    sort_order: row.sort_order,
    hierarchy: { ...EMPTY_HIERARCHY },
    orgHierarchy: {
      level_0: row.org_hierarchy?.level_0 ?? null,
      level_1: row.org_hierarchy?.level_1 ?? null,
      level_2: row.org_hierarchy?.level_2 ?? null,
    },
    metrics: {},
  }
}

function cloneMetric(metric: NodeMetricValue): NodeMetricValue {
  return {
    ...metric,
    monthly_plan: metric.monthly_plan ? { ...metric.monthly_plan } : undefined,
  }
}

function cloneNode(node: EnrichedBizDataNode): EnrichedBizDataNode {
  return {
    ...node,
    hierarchy: { ...node.hierarchy },
    orgHierarchy: { ...node.orgHierarchy },
    metrics: Object.fromEntries(
      Object.entries(node.metrics).map(([key, value]) => [key, value ? cloneMetric(value) : value])
    ),
  }
}

function getMetric(node: EnrichedBizDataNode, category: MetricCategory): NodeMetricValue {
  if (!node.metrics[category]) {
    node.metrics[category] = createEmptyMetric()
  }
  return node.metrics[category]!
}

function sumNumbers(values: Array<number | null | undefined>): number | null {
  let sum = 0
  let hasValue = false

  values.forEach(value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += value
      hasValue = true
    }
  })

  return hasValue ? sum : null
}

function divideOrNull(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null
  return numerator / denominator
}

function inferNodeKind(node: EnrichedBizDataNode): NodeKind {
  const { level_0, level_1, level_2 } = node.orgHierarchy
  const { node_name } = node

  if (!level_0 && !level_1 && !level_2) return 'orphan'
  if (level_0 && node_name === level_0 && !level_1 && !level_2) return 'total'
  if (level_1 && node_name === level_1 && !level_2) return 'level1'
  if (level_2 && node_name === level_2) return 'level2'
  return 'leaf'
}

function isLeafSourceNode(node: EnrichedBizDataNode): boolean {
  const kind = inferNodeKind(node)
  return kind === 'leaf' || kind === 'orphan'
}

function buildSyntheticNode(
  node_name: string,
  sort_order: number,
  orgHierarchy: EnrichedBizDataNode['orgHierarchy'],
  level: 'total' | 'level1' | 'level2',
  children: EnrichedBizDataNode[]
): EnrichedBizDataNode {
  return {
    node_name,
    sort_order: sort_order + SYNTHETIC_SORT_ORDER[level],
    hierarchy: {
      ...EMPTY_HIERARCHY,
      is_aggregated: true,
      aggregation_level: level,
    },
    orgHierarchy,
    metrics: aggregateMetrics(children),
  }
}

function aggregateMetrics(children: EnrichedBizDataNode[]): EnrichedBizDataNode['metrics'] {
  const aggregated: EnrichedBizDataNode['metrics'] = {}
  const categories = new Set<MetricCategory>()

  children.forEach(child => {
    Object.keys(child.metrics).forEach(key => categories.add(key as MetricCategory))
  })

  const baseCategories = [...categories].filter(category => !DERIVED_METRIC_DEPENDENCIES[category])
  const derivedCategories = [...categories].filter(category => !!DERIVED_METRIC_DEPENDENCIES[category])

  for (const category of baseCategories) {
    const values = children
      .map(child => child.metrics[category])
      .filter((metric): metric is NodeMetricValue => !!metric)

    if (values.length === 0) continue

    const monthlyPlanMonths = new Set<string>()
    values.forEach(metric => {
      Object.keys(metric.monthly_plan ?? {}).forEach(month => monthlyPlanMonths.add(month))
    })

    const monthly_plan = monthlyPlanMonths.size > 0
      ? Object.fromEntries(
          [...monthlyPlanMonths].map(month => [
            month,
            sumNumbers(values.map(metric => metric.monthly_plan?.[month])) ?? 0,
          ])
        )
      : undefined

    const actual = sumNumbers(values.map(metric => metric.actual))
    const budget_fone = sumNumbers(values.map(metric => metric.budget_fone))
    const budget_tuwei = sumNumbers(values.map(metric => metric.budget_tuwei))
    const yoy = sumNumbers(values.map(metric => metric.yoy))

    aggregated[category] = {
      actual,
      budget_fone,
      budget_tuwei,
      completion_fone: safeCompletionRate(actual, budget_fone),
      completion_tuwei: safeCompletionRate(actual, budget_tuwei),
      diff_fone: safeDiff(actual, budget_fone),
      diff_tuwei: safeDiff(actual, budget_tuwei),
      yoy,
      monthly_plan,
    }
  }

  for (const category of derivedCategories) {
    const dependency = DERIVED_METRIC_DEPENDENCIES[category]
    if (!dependency) continue

    const numerator = aggregated[dependency.numerator]
    const denominator = aggregated[dependency.denominator]

    if (!numerator || !denominator) continue

    const actual = divideOrNull(numerator.actual, denominator.actual)
    const budget_fone = divideOrNull(numerator.budget_fone, denominator.budget_fone)
    const budget_tuwei = divideOrNull(numerator.budget_tuwei, denominator.budget_tuwei)
    const yoy = divideOrNull(numerator.yoy, denominator.yoy)

    aggregated[category] = {
      actual,
      budget_fone,
      budget_tuwei,
      completion_fone: safeCompletionRate(actual, budget_fone),
      completion_tuwei: safeCompletionRate(actual, budget_tuwei),
      diff_fone: safeDiff(actual, budget_fone),
      diff_tuwei: safeDiff(actual, budget_tuwei),
      yoy,
    }
  }

  return aggregated
}

export async function fetchBizReport(options: BizDataQueryOptions = {}) {
  const {
    period,
    periodType = 'cumulative',
    reportTypes = ['fone', 'tuwei'],
    sheetCodes,
  } = options

  const PAGE_SIZE = 1000
  let allReportData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('edu_biz_report')
      .select('*')
      .eq('period_type', periodType)
      .order('sort_order')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (period) query = query.eq('period', period)
    if (reportTypes.length > 0) query = query.in('report_type', reportTypes)
    if (sheetCodes && sheetCodes.length > 0) query = query.in('sheet_code', sheetCodes)

    const { data: pageData, error } = await query
    if (error) throw error

    if (pageData && pageData.length > 0) {
      allReportData = allReportData.concat(pageData)
      hasMore = pageData.length === PAGE_SIZE
      page += 1
    } else {
      hasMore = false
    }
  }

  const { data: hierarchyData, error: hierarchyError } = await supabase
    .from('edu_org_hierarchy')
    .select('node_name, level_0, level_1, level_2')
    .range(0, 999)

  if (hierarchyError) throw hierarchyError

  const hierarchyMap = new Map((hierarchyData ?? []).map(row => [row.node_name, row]))

  return allReportData.map(row => ({
    ...row,
    org_hierarchy: hierarchyMap.get(row.node_name) ?? null,
  })) as EduBizReport[]
}

export async function fetchMonthlyPlan() {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('edu_biz_monthly_plan')
      .select('*')
      .order('sort_order')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) throw error

    if (pageData && pageData.length > 0) {
      allData = allData.concat(pageData)
      hasMore = pageData.length === PAGE_SIZE
      page += 1
    } else {
      hasMore = false
    }
  }

  return allData as EduBizMonthlyPlan[]
}

export async function fetchAvailableMonths(
  periodType: 'cumulative' | 'monthly',
  reportType: 'fone' | 'tuwei'
) {
  const { data, error } = await supabase
    .from('edu_biz_report')
    .select('period')
    .eq('period_type', periodType)
    .eq('report_type', reportType)
    .order('period', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Failed to fetch months:', error)
    return []
  }

  return Array.from(new Set(data?.map(item => item.period) ?? []))
}

export function aggregateByNode(
  foneReports: EduBizReport[],
  tuweiReports: EduBizReport[],
  monthlyPlans: EduBizMonthlyPlan[]
): EnrichedBizDataNode[] {
  const nodeMap = new Map<string, EnrichedBizDataNode>()

  const ensureNode = (row: EduBizReport) => {
    if (!nodeMap.has(row.node_name)) {
      nodeMap.set(row.node_name, createEmptyNode(row))
    }

    const node = nodeMap.get(row.node_name)!

    // Later rows may have hierarchy while earlier rows do not.
    if (!node.orgHierarchy.level_0 && row.org_hierarchy?.level_0) node.orgHierarchy.level_0 = row.org_hierarchy.level_0
    if (!node.orgHierarchy.level_1 && row.org_hierarchy?.level_1) node.orgHierarchy.level_1 = row.org_hierarchy.level_1
    if (!node.orgHierarchy.level_2 && row.org_hierarchy?.level_2) node.orgHierarchy.level_2 = row.org_hierarchy.level_2

    return node
  }

  for (const row of foneReports) {
    const node = ensureNode(row)
    const metric = getMetric(node, row.metric_category)
    metric.actual = row.actual_value
    metric.budget_fone = row.budget_value
    metric.completion_fone = row.completion_rate
    metric.diff_fone = row.diff_value
    metric.yoy = row.yoy_value
  }

  for (const row of tuweiReports) {
    const node = ensureNode(row)
    const metric = getMetric(node, row.metric_category)
    if (metric.actual == null) metric.actual = row.actual_value
    metric.budget_tuwei = row.budget_value
    metric.completion_tuwei = row.completion_rate
    metric.diff_tuwei = row.diff_value
    if (metric.yoy == null) metric.yoy = row.yoy_value
  }

  for (const plan of monthlyPlans) {
    const node = nodeMap.get(plan.node_name)
    if (!node) continue

    const metric = getMetric(node, plan.metric_category)
    if (!metric.monthly_plan) metric.monthly_plan = {}
    metric.monthly_plan[plan.month] = plan.plan_value ?? 0
  }

  return [...nodeMap.values()].sort((a, b) => a.sort_order - b.sort_order)
}

function buildLeafNodes(nodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  return nodes
    .filter(isLeafSourceNode)
    .map(cloneNode)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function buildTreeWithAggregation(nodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  const leafNodes = buildLeafNodes(nodes)

  if (leafNodes.length === 0) return []

  const level2Map = new Map<string, EnrichedBizDataNode>()
  const level1ChildrenMap = new Map<string, EnrichedBizDataNode[]>()

  const directLevel1Leaves = leafNodes.filter(node => node.orgHierarchy.level_1 && !node.orgHierarchy.level_2)
  directLevel1Leaves.forEach(node => {
    const level1 = node.orgHierarchy.level_1!
    if (!level1ChildrenMap.has(level1)) level1ChildrenMap.set(level1, [])
    level1ChildrenMap.get(level1)!.push(node)
  })

  const level2Groups = new Map<string, EnrichedBizDataNode[]>()
  leafNodes
    .filter(node => node.orgHierarchy.level_1 && node.orgHierarchy.level_2)
    .forEach(node => {
      const key = `${node.orgHierarchy.level_1}|||${node.orgHierarchy.level_2}`
      if (!level2Groups.has(key)) level2Groups.set(key, [])
      level2Groups.get(key)!.push(node)
    })

  level2Groups.forEach((children, key) => {
    const [level_1, level_2] = key.split('|||')
    const sample = children[0]
    const syntheticNode = buildSyntheticNode(
      level_2,
      Math.min(...children.map(item => item.sort_order)),
      {
        level_0: sample.orgHierarchy.level_0,
        level_1,
        level_2,
      },
      'level2',
      children
    )

    level2Map.set(key, syntheticNode)

    if (!level1ChildrenMap.has(level_1)) level1ChildrenMap.set(level_1, [])
    level1ChildrenMap.get(level_1)!.push(syntheticNode)
  })

  const level1Nodes: EnrichedBizDataNode[] = []
  level1ChildrenMap.forEach((children, level_1) => {
    const sample = children[0]
    level1Nodes.push(
      buildSyntheticNode(
        level_1,
        Math.min(...children.map(item => item.sort_order)),
        {
          level_0: sample.orgHierarchy.level_0,
          level_1,
          level_2: null,
        },
        'level1',
        children
      )
    )
  })

  level1Nodes.sort((a, b) => a.sort_order - b.sort_order)
  const level2Nodes = [...level2Map.values()].sort((a, b) => a.sort_order - b.sort_order)

  const rootLabel =
    level1Nodes.find(node => node.orgHierarchy.level_0)?.orgHierarchy.level_0 ??
    leafNodes.find(node => node.orgHierarchy.level_0)?.orgHierarchy.level_0 ??
    '智汇后勤集团'

  const totalNode = buildSyntheticNode(
    rootLabel,
    0,
    {
      level_0: rootLabel,
      level_1: null,
      level_2: null,
    },
    'total',
    level1Nodes.length > 0 ? level1Nodes : leafNodes
  )

  return [totalNode, ...level1Nodes, ...level2Nodes, ...leafNodes]
}

export interface HierarchyTree {
  total: EnrichedBizDataNode[]
  centers: EnrichedBizDataNode[]
  segments: EnrichedBizDataNode[]
  level1: EnrichedBizDataNode[]
  level2: EnrichedBizDataNode[]
  leafNodes: EnrichedBizDataNode[]
}

export function buildHierarchyTree(nodes: EnrichedBizDataNode[]): HierarchyTree {
  const allNodes = buildTreeWithAggregation(nodes)

  const total = allNodes.filter(node => inferNodeKind(node) === 'total')
  const level1 = allNodes.filter(node => inferNodeKind(node) === 'level1')
  const level2 = allNodes.filter(node => inferNodeKind(node) === 'level2')
  const leafNodes = allNodes.filter(node => {
    const kind = inferNodeKind(node)
    return kind === 'leaf' || kind === 'orphan'
  })

  return {
    total,
    centers: level1,
    segments: level2,
    level1,
    level2,
    leafNodes,
  }
}

export function getChildren(parentNode: EnrichedBizDataNode, allNodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  const kind = inferNodeKind(parentNode)

  if (kind === 'total') {
    return allNodes
      .filter(node => inferNodeKind(node) === 'level1')
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  if (kind === 'level1') {
    const level1 = parentNode.orgHierarchy.level_1
    return allNodes
      .filter(node => {
        const childKind = inferNodeKind(node)
        if (!level1 || node.orgHierarchy.level_1 !== level1) return false
        if (childKind === 'level2') return true
        return childKind === 'leaf' && !node.orgHierarchy.level_2
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  if (kind === 'level2') {
    const { level_1, level_2 } = parentNode.orgHierarchy
    return allNodes
      .filter(node => {
        if (inferNodeKind(node) !== 'leaf') return false
        return node.orgHierarchy.level_1 === level_1 && node.orgHierarchy.level_2 === level_2
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  return []
}

export function safeCompletionRate(actual: number | null, budget: number | null): number | null {
  if (actual == null || budget == null || budget === 0) return null
  return actual / budget
}

export function safeDiff(actual: number | null, budget: number | null): number | null {
  if (actual == null || budget == null) return null
  return actual - budget
}
