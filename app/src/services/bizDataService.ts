import { supabase } from '@/lib/supabase'
import type {
  EduBizReport,
  EduBizMonthlyPlan,
  EnrichedBizDataNode,
  MetricCategory,
} from '@/lib/supabase'

// --- Query Options ---
export interface BizDataQueryOptions {
  period?: string  // e.g., "<202603"
  periodType?: 'cumulative' | 'monthly'
  reportTypes?: ('fone' | 'tuwei')[]
  sheetCodes?: string[]
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
  } = options

  console.log('[fetchBizReport] Options:', { period, periodType, reportTypes })

  // Fetch edu_biz_report data with pagination to bypass 1000 row server limit
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

    const { data: pageData, error: reportError } = await query

    if (reportError) {
      console.error('[fetchBizReport] Error:', reportError)
      throw reportError
    }

    if (pageData && pageData.length > 0) {
      allReportData = allReportData.concat(pageData)
      hasMore = pageData.length === PAGE_SIZE
      page++
    } else {
      hasMore = false
    }
  }

  console.log('[fetchBizReport] Fetched rows:', allReportData.length, 'in', page, 'pages')
  const reportData = allReportData

  // Fetch edu_org_hierarchy data separately
  const { data: hierarchyData, error: hierarchyError } = await supabase
    .from('edu_org_hierarchy')
    .select('*')
    .range(0, 999)  // Fetch up to 1000 rows (should be enough for hierarchy)

  if (hierarchyError) {
    console.error('[fetchBizReport] Hierarchy error:', hierarchyError)
    throw hierarchyError
  }

  console.log('[fetchBizReport] Hierarchy rows:', hierarchyData?.length ?? 0)

  // Create a map for quick lookup
  const hierarchyMap = new Map(
    (hierarchyData ?? []).map(h => [h.node_name, h])
  )

  // Manually join the data
  const enrichedData = (reportData ?? []).map(row => ({
    ...row,
    org_hierarchy: hierarchyMap.get(row.node_name) || null
  }))

  return enrichedData as EduBizReport[]
}

/**
 * 获取月度突围计划
 */
export async function fetchMonthlyPlan() {
  // Fetch with pagination to bypass 1000 row server limit
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

    if (error) {
      console.error('Failed to fetch monthly plan:', error)
      throw error
    }

    if (pageData && pageData.length > 0) {
      allData = allData.concat(pageData)
      hasMore = pageData.length === PAGE_SIZE
      page++
    } else {
      hasMore = false
    }
  }

  console.log('[fetchMonthlyPlan] Fetched rows:', allData.length, 'in', page, 'pages')
  return allData as EduBizMonthlyPlan[]
}

/**
 * 获取可用的月份列表
 * Note: Different report_types may have different period formats for the same logical period
 * e.g., cumulative fone uses '<202603', tuwei uses '202601-202602-'
 */
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
    .limit(100)  // Periods are limited, 100 is more than enough

  if (error) {
    console.error('Failed to fetch months:', error)
    return []
  }

  // Extract unique periods
  const uniquePeriods = Array.from(new Set(data?.map(d => d.period) || []))
  console.log('[fetchAvailableMonths] Available months:', uniquePeriods)
  return uniquePeriods
}

// --- Aggregation Functions ---

/**
 * 按节点聚合数据（合并 fone 和 tuwei）
 */
export function aggregateByNode(
  foneReports: EduBizReport[],
  tuweiReports: EduBizReport[],
  monthlyPlans: EduBizMonthlyPlan[]
): EnrichedBizDataNode[] {
  console.log('[aggregateByNode] Input:', {
    foneReports: foneReports.length,
    tuweiReports: tuweiReports.length,
    monthlyPlans: monthlyPlans.length
  })

  const nodeMap = new Map<string, EnrichedBizDataNode>()

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
function createEmptyNode(row: EduBizReport | EduBizMonthlyPlan): EnrichedBizDataNode {
  // Extract orgHierarchy from EduBizReport if available
  const orgHierarchy = 'org_hierarchy' in row && row.org_hierarchy
    ? {
        level_0: row.org_hierarchy.level_0,
        level_1: row.org_hierarchy.level_1,
        level_2: row.org_hierarchy.level_2,
        level_3: row.org_hierarchy.level_3,
        label: row.org_hierarchy.label,
      }
    : {
        level_0: null,
        level_1: null,
        level_2: null,
        level_3: null,
        label: null,
      }

  return {
    node_name: row.node_name,
    sort_order: row.sort_order,
    hierarchy: {
      center_region: null,
      business_segment: null,
      report_level1: null,
      report_level2: null,
      is_aggregated: false,
      aggregation_level: null,
    },
    orgHierarchy,
    metrics: {},
  }
}

// --- Hierarchy Tree Building ---

export interface HierarchyTree {
  total: EnrichedBizDataNode[]
  centers: EnrichedBizDataNode[]
  segments: EnrichedBizDataNode[]
  level1: EnrichedBizDataNode[]
  level2: EnrichedBizDataNode[]
  leafNodes: EnrichedBizDataNode[]
}

/**
 * 聚合子节点的指标数据
 */
function aggregateMetrics(children: EnrichedBizDataNode[]): EnrichedBizDataNode['metrics'] {
  const aggregated: EnrichedBizDataNode['metrics'] = {}

  // 获取所有指标类别
  const metricCategories = new Set<string>()
  children.forEach(child => {
    Object.keys(child.metrics).forEach(key => metricCategories.add(key))
  })

  // 对每个指标进行聚合
  metricCategories.forEach(category => {
    const values = children
      .map(child => child.metrics[category as MetricCategory])
      .filter(m => m != null)

    if (values.length === 0) return

    // 聚合实际值、预算值等
    const actual = values.reduce((sum, m) => sum + (m!.actual ?? 0), 0)
    const budget_fone = values.reduce((sum, m) => sum + (m!.budget_fone ?? 0), 0)
    const budget_tuwei = values.reduce((sum, m) => sum + (m!.budget_tuwei ?? 0), 0)
    const yoy = values.reduce((sum, m) => sum + (m!.yoy ?? 0), 0)

    // 计算完成率和差异
    const completion_fone = budget_fone > 0 ? actual / budget_fone : null
    const completion_tuwei = budget_tuwei > 0 ? actual / budget_tuwei : null
    const diff_fone = actual - budget_fone
    const diff_tuwei = actual - budget_tuwei

    aggregated[category as MetricCategory] = {
      actual,
      budget_fone,
      budget_tuwei,
      completion_fone,
      completion_tuwei,
      diff_fone,
      diff_tuwei,
      yoy,
    }
  })

  return aggregated
}

/**
 * 构建包含聚合数据的完整树形结构
 *
 * 动态层级结构（根据清理后的 orgHierarchy 数据）：
 * - 如果节点有 level_3，则为叶子节点（实际业务单元）
 * - 如果节点有 level_2 但无 level_3，则为 level_2 聚合节点
 * - 如果节点只有 level_1，则为 level_1 聚合节点
 *
 * 从叶子节点开始，逐层向上聚合数据，跳过空层级
 */
export function buildTreeWithAggregation(leafNodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  console.log('[buildTreeWithAggregation] Input leaf nodes:', leafNodes.length)

  const allNodes: EnrichedBizDataNode[] = []

  // 1. 添加所有原始节点（叶子节点）
  allNodes.push(...leafNodes)

  // 2. 按 level_1 + level_2 + level_3 分组，创建 level_3 聚合节点（如果存在 level_3）
  const level3Groups = new Map<string, EnrichedBizDataNode[]>()
  leafNodes.forEach(node => {
    const { level_1, level_2, level_3 } = node.orgHierarchy
    // 只有当 level_3 存在且 node_name 不等于 level_3 时，才需要创建 level_3 聚合节点
    if (level_1 && level_2 && level_3 && node.node_name !== level_3) {
      const key = `${level_1}|${level_2}|${level_3}`
      if (!level3Groups.has(key)) {
        level3Groups.set(key, [])
      }
      level3Groups.get(key)!.push(node)
    }
  })

  level3Groups.forEach((children, key) => {
    const [level_1, level_2, level_3] = key.split('|')
    const representativeNode = children[0]

    const level3Node: EnrichedBizDataNode = {
      node_name: level_3,
      sort_order: Math.min(...children.map(c => c.sort_order)),
      hierarchy: representativeNode.hierarchy,
      orgHierarchy: {
        level_0: representativeNode.orgHierarchy.level_0,
        level_1,
        level_2,
        level_3,
        label: representativeNode.orgHierarchy.label,
      },
      metrics: aggregateMetrics(children),
    }

    allNodes.push(level3Node)
  })

  // 3. 按 level_1 + level_2 分组，创建 level_2 聚合节点
  const level2Groups = new Map<string, EnrichedBizDataNode[]>()

  // 收集需要聚合到 level_2 的节点：
  // - 直接属于 level_2 的叶子节点（有 level_2 但无 level_3）
  leafNodes.forEach(node => {
    const { level_1, level_2, level_3 } = node.orgHierarchy
    if (level_1 && level_2 && !level_3) {
      // 直接属于 level_2 的叶子节点
      const key = `${level_1}|${level_2}`
      if (!level2Groups.has(key)) {
        level2Groups.set(key, [])
      }
      level2Groups.get(key)!.push(node)
    }
  })

  // 添加 level_3 聚合节点（从刚创建的 level3Groups 中获取）
  level3Groups.forEach((_children, key) => {
    const [level_1, level_2, _level_3] = key.split('|')
    const level2Key = `${level_1}|${level_2}`

    // 找到对应的 level_3 聚合节点
    const level3Node = allNodes.find(n =>
      n.orgHierarchy.level_1 === level_1 &&
      n.orgHierarchy.level_2 === level_2 &&
      n.orgHierarchy.level_3 === _level_3 &&
      n.node_name === _level_3
    )

    if (level3Node) {
      if (!level2Groups.has(level2Key)) {
        level2Groups.set(level2Key, [])
      }
      level2Groups.get(level2Key)!.push(level3Node)
    }
  })

  level2Groups.forEach((children, key) => {
    const [level_1, level_2] = key.split('|')
    const representativeNode = children[0]

    // 始终创建 level_2 聚合节点（如果有子节点）
    const level2Node: EnrichedBizDataNode = {
      node_name: level_2,
      sort_order: Math.min(...children.map(c => c.sort_order)),
      hierarchy: representativeNode.hierarchy,
      orgHierarchy: {
        level_0: representativeNode.orgHierarchy.level_0,
        level_1,
        level_2,
        level_3: null,
        label: representativeNode.orgHierarchy.label,
      },
      metrics: aggregateMetrics(children),
    }

    allNodes.push(level2Node)
  })

  // 4. 按 level_1 分组，创建 level_1 聚合节点
  const level1Groups = new Map<string, EnrichedBizDataNode[]>()

  // 收集需要聚合到 level_1 的节点：
  // - 直接属于 level_1 的叶子节点（只有 level_1）
  leafNodes.forEach(node => {
    const { level_1, level_2 } = node.orgHierarchy
    if (level_1 && !level_2) {
      // 直接属于 level_1 的叶子节点
      if (!level1Groups.has(level_1)) {
        level1Groups.set(level_1, [])
      }
      level1Groups.get(level_1)!.push(node)
    }
  })

  // 添加 level_2 聚合节点（从刚创建的 level2Groups 中获取）
  level2Groups.forEach((_children, key) => {
    const [level_1, level_2] = key.split('|')

    // 找到对应的 level_2 聚合节点
    const level2Node = allNodes.find(n =>
      n.orgHierarchy.level_1 === level_1 &&
      n.orgHierarchy.level_2 === level_2 &&
      n.orgHierarchy.level_3 === null &&
      n.node_name === level_2
    )

    if (level2Node) {
      if (!level1Groups.has(level_1)) {
        level1Groups.set(level_1, [])
      }
      level1Groups.get(level_1)!.push(level2Node)
    }
  })

  level1Groups.forEach((children, level_1) => {
    const representativeNode = children[0]

    // 始终创建 level_1 聚合节点（如果有子节点）
    const level1Node: EnrichedBizDataNode = {
      node_name: level_1,
      sort_order: Math.min(...children.map(c => c.sort_order)),
      hierarchy: representativeNode.hierarchy,
      orgHierarchy: {
        level_0: representativeNode.orgHierarchy.level_0,
        level_1,
        level_2: null,
        level_3: null,
        label: representativeNode.orgHierarchy.label,
      },
      metrics: aggregateMetrics(children),
    }

    allNodes.push(level1Node)
  })

  // 5. 创建 level_0 聚合节点（智汇后勤集团）
  // 收集所有 level_1 聚合节点
  const level0Children = allNodes.filter(n => {
    const { level_1, level_2, level_3 } = n.orgHierarchy
    return level_1 && !level_2 && !level_3 && n.node_name === level_1
  })

  if (level0Children.length > 0) {
    const representativeNode = level0Children[0]
    const level_0 = representativeNode.orgHierarchy.level_0 ?? '智汇后勤集团'

    const level0Node: EnrichedBizDataNode = {
      node_name: level_0,
      sort_order: 0,
      hierarchy: representativeNode.hierarchy,
      orgHierarchy: {
        level_0,
        level_1: null,
        level_2: null,
        level_3: null,
        label: null,
      },
      metrics: aggregateMetrics(level0Children),
    }

    allNodes.push(level0Node)
  }

  console.log('[buildTreeWithAggregation] Output nodes:', allNodes.length)
  console.log('[buildTreeWithAggregation] Breakdown:', {
    level0: allNodes.filter(n => {
      const { level_0, level_1 } = n.orgHierarchy
      return level_0 && !level_1 && n.node_name === level_0
    }).length,
    level1: allNodes.filter(n => {
      const { level_1, level_2, level_3 } = n.orgHierarchy
      return level_1 && !level_2 && !level_3 && n.node_name === level_1
    }).length,
    level2: allNodes.filter(n => {
      const { level_1, level_2, level_3 } = n.orgHierarchy
      return level_1 && level_2 && !level_3 && n.node_name === level_2
    }).length,
    level3: allNodes.filter(n => {
      const { level_1, level_2, level_3 } = n.orgHierarchy
      return level_1 && level_2 && level_3 && n.node_name === level_3
    }).length,
    leafNodes: leafNodes.length,
  })

  return allNodes
}

/**
 * 构建层级树（向后兼容接口）
 */
export function buildHierarchyTree(nodes: EnrichedBizDataNode[]): HierarchyTree {
  console.log('[buildHierarchyTree] Input nodes:', nodes.length)

  // 使用新的聚合函数构建完整树
  const allNodes = buildTreeWithAggregation(nodes)

  // 按层级分类
  const level1 = allNodes.filter(n => {
    const { level_1, level_2, level_3 } = n.orgHierarchy
    return level_1 && !level_2 && !level_3 && n.node_name === level_1
  })

  const level2 = allNodes.filter(n => {
    const { level_1, level_2, level_3 } = n.orgHierarchy
    return level_1 && level_2 && !level_3 && n.node_name === level_2
  })

  const level3 = allNodes.filter(n => {
    const { level_1, level_2, level_3 } = n.orgHierarchy
    return level_1 && level_2 && level_3 && n.node_name === level_3
  })

  const leafNodes = allNodes.filter(n => {
    const { level_1, level_2, level_3 } = n.orgHierarchy
    return level_1 && level_2 && level_3 && n.node_name !== level_3
  })

  // For backward compatibility
  const total: EnrichedBizDataNode[] = []
  const centers = level1
  const segments = level2

  console.log('[buildHierarchyTree] Results:', {
    total: total.length,
    centers: centers.length,
    segments: segments.length,
    level1: level1.length,
    level2: level2.length,
    level3: level3.length,
    leafNodes: leafNodes.length
  })

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
 * 使用 orgHierarchy 字段 (level_1, level_2, level_3) 和 node_name 来确定父子关系
 *
 * 动态层级结构（根据清理后的数据）：
 * - Level 1 节点 (只有 level_1，node_name = level_1) -> 返回所有 level_2 节点或直接子节点
 * - Level 2 节点 (有 level_1, level_2，node_name = level_2) -> 返回所有 level_3 节点或直接子节点
 * - Level 3 节点 (有 level_1, level_2, level_3，node_name = level_3) -> 返回所有实际业务单元
 * - 叶子节点 (node_name ≠ 层级名称) -> 无子节点
 */
export function getChildren(parentNode: EnrichedBizDataNode, allNodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  const { level_0, level_1, level_2, level_3 } = parentNode.orgHierarchy
  const { node_name } = parentNode

  // Level 0 节点：返回所有 level_1 聚合节点
  if (level_0 && !level_1 && !level_2 && !level_3 && node_name === level_0) {
    return allNodes.filter(n =>
      n.orgHierarchy.level_1 !== null &&
      n.orgHierarchy.level_2 === null &&
      n.orgHierarchy.level_3 === null &&
      n.node_name === n.orgHierarchy.level_1
    ).sort((a, b) => a.sort_order - b.sort_order)
  }

  // Level 1 节点：返回所有匹配 level_1 的下级节点
  if (level_1 && !level_2 && !level_3 && node_name === level_1) {
    return allNodes.filter(n => {
      // 返回 level_2 聚合节点或直接属于 level_1 的叶子节点
      return n.orgHierarchy.level_1 === level_1 && (
        // level_2 聚合节点
        (n.orgHierarchy.level_2 !== null && n.orgHierarchy.level_3 === null && n.node_name === n.orgHierarchy.level_2) ||
        // 直接属于 level_1 的叶子节点（只有 level_1，无 level_2）
        (n.orgHierarchy.level_2 === null && n.node_name !== level_1)
      )
    }).sort((a, b) => a.sort_order - b.sort_order)
  }

  // Level 2 节点：返回所有匹配 level_1 + level_2 的下级节点
  if (level_1 && level_2 && !level_3 && node_name === level_2) {
    return allNodes.filter(n => {
      return n.orgHierarchy.level_1 === level_1 &&
        n.orgHierarchy.level_2 === level_2 && (
          // level_3 聚合节点
          (n.orgHierarchy.level_3 !== null && n.node_name === n.orgHierarchy.level_3) ||
          // 直接属于 level_2 的叶子节点（无 level_3）
          (n.orgHierarchy.level_3 === null && n.node_name !== level_2)
        )
    }).sort((a, b) => a.sort_order - b.sort_order)
  }

  // Level 3 节点：返回所有匹配 level_1 + level_2 + level_3 的实际业务单元
  if (level_1 && level_2 && level_3 && node_name === level_3) {
    return allNodes.filter(n =>
      n.orgHierarchy.level_1 === level_1 &&
      n.orgHierarchy.level_2 === level_2 &&
      n.orgHierarchy.level_3 === level_3 &&
      n.node_name !== level_3  // 实际业务单元的 node_name 不等于 level_3
    ).sort((a, b) => a.sort_order - b.sort_order)
  }

  // 叶子节点：无子节点
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
