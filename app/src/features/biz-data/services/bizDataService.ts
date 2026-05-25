import { supabase } from '@/shared/lib/supabase'
import type {
  EduBizReport,
  EduBizMonthlyPlan,
  EduStrategyBudgetPlan,
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
export type HierarchyNodeKind = NodeKind

const CACHE_TTL_MS = 5 * 60 * 1000
const BIZ_REPORT_SELECT = [
  'id',
  'sheet_code',
  'report_type',
  'period_type',
  'period',
  'period_yoy',
  'node_name',
  'sort_order',
  'metric_category',
  'metric_category_cn',
  'actual_value',
  'budget_value',
  'completion_rate',
  'diff_value',
  'yoy_value',
  'created_at',
].join(', ')

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const pendingRequests = new Map<string, Promise<unknown>>()

async function cachedRequest<T>(key: string, loader: () => Promise<T>, ttlMs = CACHE_TTL_MS): Promise<T> {
  const cached = memoryCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T
  }

  const pending = pendingRequests.get(key)
  if (pending) {
    return pending as Promise<T>
  }

  const request = loader()
    .then((value) => {
      memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs })
      pendingRequests.delete(key)
      return value
    })
    .catch((error) => {
      pendingRequests.delete(key)
      throw error
    })

  pendingRequests.set(key, request)
  return request
}

export interface NestedBizDataNode {
  node_name: string
  org_scope_key: string
  org_path: string[]
  sort_order: number
  node_kind: HierarchyNodeKind
  hierarchy: EnrichedBizDataNode['hierarchy']
  orgHierarchy: EnrichedBizDataNode['orgHierarchy']
  metrics: EnrichedBizDataNode['metrics']
  children: NestedBizDataNode[]
}

export interface HierarchyChildrenIndex {
  getChildren: (node: EnrichedBizDataNode) => EnrichedBizDataNode[]
  hasChildren: (node: EnrichedBizDataNode) => boolean
}

async function fetchDistinctColumnValues(
  table: 'edu_biz_report' | 'edu_biz_monthly_plan',
  column: 'period' | 'month',
  filters?: {
    periodType?: 'cumulative' | 'monthly'
    reportType?: 'fone' | 'tuwei'
  },
): Promise<string[]> {
  const PAGE_SIZE = 1000
  const values = new Set<string>()
  let page = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(column)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (table === 'edu_biz_report' && filters?.periodType) {
      query = query.eq('period_type', filters.periodType)
    }

    if (table === 'edu_biz_report' && filters?.reportType) {
      query = query.eq('report_type', filters.reportType)
    }

    const { data, error } = await query
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

  return [...values].sort((a, b) => b.localeCompare(a))
}

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
    actual_fone: null,
    actual_tuwei: null,
    budget_fone: null,
    budget_tuwei: null,
    completion_fone: null,
    completion_tuwei: null,
    diff_fone: null,
    diff_tuwei: null,
    yoy: null,
    yoy_fone: null,
    yoy_tuwei: null,
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

function normalizeNodeName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function normalizeOrgScopePart(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function buildOrgPath(node: Pick<EnrichedBizDataNode, 'node_name' | 'orgHierarchy'>): string[] {
  const { level_0, level_1, level_2 } = node.orgHierarchy
  const parts = [level_0, level_1, level_2, node.node_name]
    .map(normalizeOrgScopePart)
    .filter((part): part is string => part.length > 0)

  return parts.filter((part, index) => index === 0 || part !== parts[index - 1])
}

export function buildOrgScopeKey(node: Pick<EnrichedBizDataNode, 'node_name' | 'orgHierarchy'>): string {
  return buildOrgPath(node).join(' / ')
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

    const actual_fone = sumNumbers(values.map(metric => metric.actual_fone ?? metric.actual))
    const actual_tuwei = sumNumbers(values.map(metric => metric.actual_tuwei ?? metric.actual))
    const actual = actual_fone ?? actual_tuwei
    const budget_fone = sumNumbers(values.map(metric => metric.budget_fone))
    const budget_tuwei = sumNumbers(values.map(metric => metric.budget_tuwei))
    const yoy_fone = sumNumbers(values.map(metric => metric.yoy_fone ?? metric.yoy))
    const yoy_tuwei = sumNumbers(values.map(metric => metric.yoy_tuwei ?? metric.yoy))
    const yoy = yoy_fone ?? yoy_tuwei

    aggregated[category] = {
      actual,
      actual_fone,
      actual_tuwei,
      budget_fone,
      budget_tuwei,
      completion_fone: safeCompletionRate(actual_fone, budget_fone),
      completion_tuwei: safeCompletionRate(actual_tuwei, budget_tuwei),
      diff_fone: safeDiff(actual_fone, budget_fone),
      diff_tuwei: safeDiff(actual_tuwei, budget_tuwei),
      yoy,
      yoy_fone,
      yoy_tuwei,
      monthly_plan,
    }
  }

  for (const category of derivedCategories) {
    const dependency = DERIVED_METRIC_DEPENDENCIES[category]
    if (!dependency) continue

    const numerator = aggregated[dependency.numerator]
    const denominator = aggregated[dependency.denominator]

    if (!numerator || !denominator) continue

    const actual_fone = divideOrNull(numerator.actual_fone ?? numerator.actual, denominator.actual_fone ?? denominator.actual)
    const actual_tuwei = divideOrNull(numerator.actual_tuwei ?? numerator.actual, denominator.actual_tuwei ?? denominator.actual)
    const actual = actual_fone ?? actual_tuwei
    const budget_fone = divideOrNull(numerator.budget_fone, denominator.budget_fone)
    const budget_tuwei = divideOrNull(numerator.budget_tuwei, denominator.budget_tuwei)
    const yoy_fone = divideOrNull(numerator.yoy_fone ?? numerator.yoy, denominator.yoy_fone ?? denominator.yoy)
    const yoy_tuwei = divideOrNull(numerator.yoy_tuwei ?? numerator.yoy, denominator.yoy_tuwei ?? denominator.yoy)
    const yoy = yoy_fone ?? yoy_tuwei

    aggregated[category] = {
      actual,
      actual_fone,
      actual_tuwei,
      budget_fone,
      budget_tuwei,
      completion_fone: safeCompletionRate(actual_fone, budget_fone),
      completion_tuwei: safeCompletionRate(actual_tuwei, budget_tuwei),
      diff_fone: safeDiff(actual_fone, budget_fone),
      diff_tuwei: safeDiff(actual_tuwei, budget_tuwei),
      yoy,
      yoy_fone,
      yoy_tuwei,
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

  const cacheKey = [
    'biz-report',
    period ?? '',
    periodType,
    reportTypes.join(','),
    sheetCodes?.join(',') ?? '',
  ].join('|')

  return cachedRequest(cacheKey, async () => {
    const PAGE_SIZE = 1000
    let allReportData: EduBizReport[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('edu_biz_report')
        .select(BIZ_REPORT_SELECT)
        .eq('period_type', periodType)
        .order('sort_order')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (period) query = query.eq('period', period)
      if (reportTypes.length > 0) query = query.in('report_type', reportTypes)
      if (sheetCodes && sheetCodes.length > 0) query = query.in('sheet_code', sheetCodes)

      const { data: pageData, error } = await query
      if (error) throw error

      if (pageData && pageData.length > 0) {
        allReportData = allReportData.concat(pageData as unknown as EduBizReport[])
        hasMore = pageData.length === PAGE_SIZE
        page += 1
      } else {
        hasMore = false
      }
    }

    const hierarchyData = await cachedRequest('edu-org-hierarchy', async () => {
      const { data, error } = await supabase
        .from('edu_org_hierarchy')
        .select('node_name, level_0, level_1, level_2')
        .range(0, 999)

      if (error) throw error
      return data ?? []
    })

    const hierarchyMap = new Map(hierarchyData.map(row => [row.node_name, row]))

    return allReportData.map(row => ({
      ...row,
      org_hierarchy: hierarchyMap.get(row.node_name) ?? null,
    })) as EduBizReport[]
  })
}

export async function fetchMonthlyPlan() {
  return cachedRequest('edu-biz-monthly-plan', async () => {
    const PAGE_SIZE = 1000
    let allData: EduBizMonthlyPlan[] = []
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
        allData = allData.concat(pageData as unknown as EduBizMonthlyPlan[])
        hasMore = pageData.length === PAGE_SIZE
        page += 1
      } else {
        hasMore = false
      }
    }

    return allData as EduBizMonthlyPlan[]
  })
}

export async function fetchStrategyBudgetPlan() {
  const PAGE_SIZE = 1000
  let allData: EduStrategyBudgetPlan[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('edu_strategy_budget_plan')
      .select('*')
      .order('sort_order')
      .order('plan_year')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) throw error

    if (pageData && pageData.length > 0) {
      allData = allData.concat(pageData as EduStrategyBudgetPlan[])
      hasMore = pageData.length === PAGE_SIZE
      page += 1
    } else {
      hasMore = false
    }
  }

  return allData
}

export async function fetchAvailableMonths(
  periodType: 'cumulative' | 'monthly',
  reportType: 'fone' | 'tuwei'
) {
  return cachedRequest(`available-months|${periodType}|${reportType}`, () =>
    fetchDistinctColumnValues('edu_biz_report', 'period', {
      periodType,
      reportType,
    })
  )
}

const aggregatedTreeCache = new WeakMap<EnrichedBizDataNode[], EnrichedBizDataNode[]>()

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
    metric.actual_fone = row.actual_value
    metric.budget_fone = row.budget_value
    metric.completion_fone = row.completion_rate
    metric.diff_fone = row.diff_value
    metric.yoy = row.yoy_value
    metric.yoy_fone = row.yoy_value
  }

  for (const row of tuweiReports) {
    const node = ensureNode(row)
    const metric = getMetric(node, row.metric_category)
    if (metric.actual == null) metric.actual = row.actual_value
    metric.actual_tuwei = row.actual_value
    metric.budget_tuwei = row.budget_value
    metric.completion_tuwei = row.completion_rate
    metric.diff_tuwei = row.diff_value
    if (metric.yoy == null) metric.yoy = row.yoy_value
    metric.yoy_tuwei = row.yoy_value
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
  const cached = aggregatedTreeCache.get(nodes)
  if (cached) {
    return cached
  }

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

  const aggregatedNodes = [totalNode, ...level1Nodes, ...level2Nodes, ...leafNodes]
  aggregatedTreeCache.set(nodes, aggregatedNodes)
  return aggregatedNodes
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

export function getNodeKind(node: EnrichedBizDataNode): HierarchyNodeKind {
  return inferNodeKind(node)
}

function buildNodeLookupKey(node: EnrichedBizDataNode): string {
  return [
    inferNodeKind(node),
    node.node_name,
    node.orgHierarchy.level_0 ?? '',
    node.orgHierarchy.level_1 ?? '',
    node.orgHierarchy.level_2 ?? '',
  ].join('|||')
}

export function buildHierarchyChildrenIndex(allNodes: EnrichedBizDataNode[]): HierarchyChildrenIndex {
  const childrenByNodeKey = new Map<string, EnrichedBizDataNode[]>()
  const level1Children = new Map<string, EnrichedBizDataNode[]>()
  const level2Children = new Map<string, EnrichedBizDataNode[]>()
  const level1Nodes: EnrichedBizDataNode[] = []
  const totalNodes: EnrichedBizDataNode[] = []

  for (const node of allNodes) {
    const kind = inferNodeKind(node)

    if (kind === 'total') {
      totalNodes.push(node)
      continue
    }

    if (kind === 'level1') {
      level1Nodes.push(node)
      continue
    }

    if (kind === 'level2') {
      const level1 = node.orgHierarchy.level_1
      if (!level1) continue
      const children = level1Children.get(level1) ?? []
      children.push(node)
      level1Children.set(level1, children)
      continue
    }

    if (kind !== 'leaf') {
      continue
    }

    const { level_1, level_2 } = node.orgHierarchy
    if (!level_1) continue

    if (!level_2) {
      const children = level1Children.get(level_1) ?? []
      children.push(node)
      level1Children.set(level_1, children)
      continue
    }

    const key = `${level_1}|||${level_2}`
    const children = level2Children.get(key) ?? []
    children.push(node)
    level2Children.set(key, children)
  }

  const sortNodes = (nodes: EnrichedBizDataNode[]) =>
    nodes.slice().sort((left, right) => left.sort_order - right.sort_order)

  const sortedLevel1Nodes = sortNodes(level1Nodes)
  totalNodes.forEach((node) => {
    childrenByNodeKey.set(buildNodeLookupKey(node), sortedLevel1Nodes)
  })

  level1Nodes.forEach((node) => {
    const level1 = node.orgHierarchy.level_1
    if (!level1) return
    const children = level1Children.get(level1) ?? []
    childrenByNodeKey.set(buildNodeLookupKey(node), sortNodes(children))
  })

  allNodes.forEach((node) => {
    if (inferNodeKind(node) !== 'level2') return
    const { level_1, level_2 } = node.orgHierarchy
    if (!level_1 || !level_2) return
    const children = level2Children.get(`${level_1}|||${level_2}`) ?? []
    childrenByNodeKey.set(buildNodeLookupKey(node), sortNodes(children))
  })

  return {
    getChildren(node) {
      return childrenByNodeKey.get(buildNodeLookupKey(node)) ?? []
    },
    hasChildren(node) {
      return (childrenByNodeKey.get(buildNodeLookupKey(node))?.length ?? 0) > 0
    },
  }
}

function buildNestedNode(
  node: EnrichedBizDataNode,
  allNodes: EnrichedBizDataNode[]
): NestedBizDataNode {
  const children = getChildren(node, allNodes)

  return {
    node_name: node.node_name,
    org_scope_key: buildOrgScopeKey(node),
    org_path: buildOrgPath(node),
    sort_order: node.sort_order,
    node_kind: inferNodeKind(node),
    hierarchy: { ...node.hierarchy },
    orgHierarchy: { ...node.orgHierarchy },
    metrics: Object.fromEntries(
      Object.entries(node.metrics).map(([key, value]) => [key, value ? cloneMetric(value) : value])
    ),
    children: children.map(child => buildNestedNode(child, allNodes)),
  }
}

export function buildNestedHierarchy(nodes: EnrichedBizDataNode[]): NestedBizDataNode[] {
  const allNodes = buildTreeWithAggregation(nodes)
  const roots = allNodes.filter(node => {
    const kind = inferNodeKind(node)
    return kind === 'total' || kind === 'orphan'
  })

  return roots
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(root => buildNestedNode(root, allNodes))
}

export interface HierarchyNodeMatch {
  node: EnrichedBizDataNode
  matchType: 'org_scope_key' | 'exact' | 'contains'
}

export function findHierarchyNodeByScopeKey(
  nodes: EnrichedBizDataNode[],
  orgScopeKey: string
): EnrichedBizDataNode | null {
  const normalizedKey = normalizeNodeName(orgScopeKey)
  if (!normalizedKey) return null

  return buildTreeWithAggregation(nodes).find(node => normalizeNodeName(buildOrgScopeKey(node)) === normalizedKey) ?? null
}

export function findHierarchyNodeMatches(
  nodes: EnrichedBizDataNode[],
  rawName: string
): HierarchyNodeMatch[] {
  const normalizedName = normalizeNodeName(rawName)
  if (!normalizedName) return []

  const allNodes = buildTreeWithAggregation(nodes)
  const exactMatches = allNodes.filter(node => normalizeNodeName(node.node_name) === normalizedName)
  if (exactMatches.length > 0) {
    return exactMatches.map(node => ({ node, matchType: 'exact' as const }))
  }

  return allNodes
    .filter(node => normalizeNodeName(node.node_name).includes(normalizedName))
    .map(node => ({ node, matchType: 'contains' as const }))
}

export function buildNestedSubtree(
  nodes: EnrichedBizDataNode[],
  rootNodeName: string
): NestedBizDataNode | null {
  const allNodes = buildTreeWithAggregation(nodes)
  const root = allNodes.find(node => node.node_name === rootNodeName)

  if (!root) return null

  return buildNestedNode(root, allNodes)
}

export function buildNestedSubtreeByScopeKey(
  nodes: EnrichedBizDataNode[],
  orgScopeKey: string
): NestedBizDataNode | null {
  const allNodes = buildTreeWithAggregation(nodes)
  const root = allNodes.find(node => normalizeNodeName(buildOrgScopeKey(node)) === normalizeNodeName(orgScopeKey))

  if (!root) return null

  return buildNestedNode(root, allNodes)
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

export interface BizDataFilters {
  reportType: 'fone' | 'tuwei'
  periodType: 'cumulative' | 'monthly'
  selectedMonth: string
}

export async function loadAvailableMonths(params: {
  reportType: 'fone' | 'tuwei'
  periodType: 'cumulative' | 'monthly'
}) {
  return fetchAvailableMonths(params.periodType, params.reportType)
}

export async function loadBizData(filters: BizDataFilters) {
  const reports = await fetchBizReport({
    period: filters.selectedMonth,
    periodType: filters.periodType,
    reportTypes: [filters.reportType],
  })

  const monthlyPlans = await fetchMonthlyPlan()
  const foneReports = filters.reportType === 'fone' ? reports : []
  const tuweiReports = filters.reportType === 'tuwei' ? reports : []

  return aggregateByNode(foneReports, tuweiReports, monthlyPlans)
}

export async function loadStrategyBudgetPlan() {
  return fetchStrategyBudgetPlan()
}
