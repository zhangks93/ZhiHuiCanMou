import type { RegisteredTool, ToolDefinition } from '../types'
import type { EduBizReport, EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import {
  aggregateByNode,
  buildTreeWithAggregation,
  fetchBizReport,
  fetchMonthlyPlan,
  findHierarchyNodeMatches,
  getChildren,
  getNodeKind,
} from '@/features/biz-data/services/bizDataService'
import {
  contributionShare,
  DEFAULT_REPORT_METRICS,
  formatPctForJudgement,
  inferPreviousMonth,
  LOWER_IS_BETTER_METRICS,
  statusByCompletion,
} from './reportCalculations'
import type {
  BusinessReportPack,
  BusinessReportWarning,
  BusinessReportWritingBrief,
  CompositionRow,
  CostExpenseRow,
  DataCompletenessMatrixRow,
  ManualFillSection,
  MissingDataNote,
  MetricCoverage,
  PeriodScope,
  RankingRow,
  ReportMetricValue,
  ReportType,
  OrganizationCoverageRow,
  OrganizationMetricRow,
  ScopeProfile,
  SummaryCard,
  TargetVsActualRow,
  UnitCard,
} from './reportPackTypes'

type QueryBusinessReportPackArgs = {
  node_name?: string
  month: string
  previous_month?: string
  cumulative_period: string
  report_types?: ReportType[]
  max_units?: number
}

const REPORT_TYPE_VALUES = new Set(['fone', 'tuwei'])
const SUMMARY_METRICS: MetricCategory[] = ['revenue', 'gross_profit', 'pretax_profit', 'labor_cost']
const COST_EXPENSE_METRICS: MetricCategory[] = [
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
  'labor_cost_rate',
]
const COST_EXPENSE_DETAIL_METRICS = COST_EXPENSE_METRICS.filter(metric => metric !== 'labor_cost_rate')
const ALL_REPORT_METRICS = DEFAULT_REPORT_METRICS

const FALLBACK_METRIC_LABELS: Record<MetricCategory, string> = {
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

function validateArgs(args: Record<string, unknown>):
  | { ok: true; values: QueryBusinessReportPackArgs }
  | { ok: false; message: string } {
  const month = args.month
  const cumulativePeriod = args.cumulative_period
  const previousMonth = args.previous_month
  const nodeName = args.node_name
  const reportTypes = args.report_types
  const maxUnits = args.max_units

  if (nodeName !== undefined && typeof nodeName !== 'string') {
    return { ok: false, message: 'node_name 如传入，必须为字符串；传空字符串表示集团整体' }
  }

  if (typeof month !== 'string' || !month.trim()) {
    return { ok: false, message: 'month 必须为非空字符串，且必须使用 Runtime Data Context 中合法 monthly period' }
  }

  if (previousMonth !== undefined && (typeof previousMonth !== 'string' || !previousMonth.trim())) {
    return { ok: false, message: 'previous_month 如传入，必须为非空字符串' }
  }

  if (typeof cumulativePeriod !== 'string' || !cumulativePeriod.trim()) {
    return { ok: false, message: 'cumulative_period 必须为非空字符串，且必须使用 Runtime Data Context 中合法 cumulative period' }
  }

  if (reportTypes !== undefined) {
    if (!Array.isArray(reportTypes) || reportTypes.length === 0) {
      return { ok: false, message: 'report_types 如传入，必须为非空数组' }
    }
    for (const reportType of reportTypes) {
      if (typeof reportType !== 'string' || !REPORT_TYPE_VALUES.has(reportType)) {
        return { ok: false, message: `report_types 含非法口径: ${String(reportType)}` }
      }
    }
  }

  if (maxUnits !== undefined && (typeof maxUnits !== 'number' || !Number.isInteger(maxUnits) || maxUnits < 1 || maxUnits > 200)) {
    return { ok: false, message: 'max_units 如传入，必须是 1-200 的整数' }
  }

  return {
    ok: true,
    values: {
      node_name: nodeName?.trim() ?? '',
      month: month.trim(),
      previous_month: previousMonth?.trim(),
      cumulative_period: cumulativePeriod.trim(),
      report_types: reportTypes as ReportType[] | undefined,
      max_units: maxUnits as number | undefined,
    },
  }
}

function buildMetricLabelMap(reports: EduBizReport[]): Map<MetricCategory, string> {
  const labelMap = new Map<MetricCategory, string>()
  DEFAULT_REPORT_METRICS.forEach(metric => labelMap.set(metric, FALLBACK_METRIC_LABELS[metric]))
  reports.forEach(report => {
    if (!labelMap.has(report.metric_category)) {
      labelMap.set(report.metric_category, report.metric_category_cn)
    }
  })
  return labelMap
}

function aggregateReportNodes(reports: EduBizReport[], monthlyPlans: Awaited<ReturnType<typeof fetchMonthlyPlan>>): EnrichedBizDataNode[] {
  const foneReports = reports.filter(row => row.report_type === 'fone')
  const tuweiReports = reports.filter(row => row.report_type === 'tuwei')
  return aggregateByNode(foneReports, tuweiReports, monthlyPlans)
}

function resolveRootNode(nodes: EnrichedBizDataNode[], nodeName: string):
  | { ok: true; root: EnrichedBizDataNode | null; allNodes: EnrichedBizDataNode[] }
  | { ok: false; message: string; candidates?: unknown[] } {
  if (!nodes.length) return { ok: true, root: null, allNodes: [] }

  const allNodes = buildTreeWithAggregation(nodes)
  if (!nodeName.trim()) {
    const root = allNodes.find(node => getNodeKind(node) === 'total') ?? allNodes[0] ?? null
    return { ok: true, root, allNodes }
  }

  const matches = findHierarchyNodeMatches(nodes, nodeName)
  if (matches.length === 0) {
    return { ok: false, message: '未找到匹配的组织节点' }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      message: '匹配到多个组织节点，请提供更精确的 node_name',
      candidates: matches.slice(0, 20).map(match => ({
        node_name: match.node.node_name,
        node_kind: getNodeKind(match.node),
        match_type: match.matchType,
        org_hierarchy: match.node.orgHierarchy,
      })),
    }
  }

  const matchedName = matches[0].node.node_name
  return {
    ok: true,
    root: allNodes.find(node => node.node_name === matchedName) ?? matches[0].node,
    allNodes,
  }
}

function flattenSubtree(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[]): EnrichedBizDataNode[] {
  if (!root) return []
  const result: EnrichedBizDataNode[] = []
  const visit = (node: EnrichedBizDataNode) => {
    result.push(node)
    getChildren(node, allNodes).forEach(visit)
  }
  visit(root)
  return result
}

function collectSubtreeWithDepth(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], maxDepth?: number): Array<{
  node: EnrichedBizDataNode
  depth: number
}> {
  if (!root) return []
  const result: Array<{ node: EnrichedBizDataNode; depth: number }> = []
  const visit = (node: EnrichedBizDataNode, depth: number) => {
    if (maxDepth !== undefined && depth > maxDepth) return
    result.push({ node, depth })
    getChildren(node, allNodes).forEach(child => visit(child, depth + 1))
  }
  visit(root, 0)
  return result
}

function metricValue(
  node: EnrichedBizDataNode | null,
  metric: MetricCategory,
  reportType: ReportType,
  labelMap: Map<MetricCategory, string>,
  previousNode?: EnrichedBizDataNode | null
): ReportMetricValue {
  const value = node?.metrics[metric]
  const previousValue = previousNode?.metrics[metric]
  const target = reportType === 'fone' ? value?.budget_fone : value?.budget_tuwei
  const completionRate = reportType === 'fone' ? value?.completion_fone : value?.completion_tuwei
  const diff = reportType === 'fone' ? value?.diff_fone : value?.diff_tuwei
  const previousActual = previousValue?.actual
  const actual = value?.actual ?? null

  return {
    metric,
    metric_label: labelMap.get(metric) ?? metric,
    actual,
    target: target ?? null,
    completion_rate: completionRate ?? null,
    diff: diff ?? null,
    yoy: value?.yoy ?? null,
    mom: actual != null && previousActual != null ? actual - previousActual : null,
  }
}

function buildTargetVsActualRow(
  node: EnrichedBizDataNode | null,
  reportType: ReportType,
  periodScope: PeriodScope
): TargetVsActualRow {
  const revenue = node?.metrics.revenue
  const profit = node?.metrics.pretax_profit
  return {
    report_type: reportType,
    period_scope: periodScope,
    node_name: node?.node_name ?? '未匹配节点',
    revenue_actual: revenue?.actual ?? null,
    revenue_target: reportType === 'fone' ? revenue?.budget_fone ?? null : revenue?.budget_tuwei ?? null,
    revenue_completion_rate: reportType === 'fone' ? revenue?.completion_fone ?? null : revenue?.completion_tuwei ?? null,
    revenue_diff: reportType === 'fone' ? revenue?.diff_fone ?? null : revenue?.diff_tuwei ?? null,
    pretax_profit_actual: profit?.actual ?? null,
    pretax_profit_target: reportType === 'fone' ? profit?.budget_fone ?? null : profit?.budget_tuwei ?? null,
    pretax_profit_completion_rate: reportType === 'fone' ? profit?.completion_fone ?? null : profit?.completion_tuwei ?? null,
    pretax_profit_diff: reportType === 'fone' ? profit?.diff_fone ?? null : profit?.diff_tuwei ?? null,
  }
}

function buildSummaryCards(params: {
  monthRoot: EnrichedBizDataNode | null
  previousRoot: EnrichedBizDataNode | null
  cumulativeRoot: EnrichedBizDataNode | null
  reportTypes: ReportType[]
  labelMap: Map<MetricCategory, string>
}): SummaryCard[] {
  const rows: SummaryCard[] = []
  for (const reportType of params.reportTypes) {
    for (const metric of SUMMARY_METRICS) {
      const monthlyMetric = metricValue(params.monthRoot, metric, reportType, params.labelMap, params.previousRoot)
      rows.push({
        ...monthlyMetric,
        report_type: reportType,
        period_scope: 'monthly',
        status: statusByCompletion(monthlyMetric.completion_rate, LOWER_IS_BETTER_METRICS.has(metric)),
      })

      const cumulativeMetric = metricValue(params.cumulativeRoot, metric, reportType, params.labelMap)
      rows.push({
        ...cumulativeMetric,
        report_type: reportType,
        period_scope: 'cumulative',
        status: statusByCompletion(cumulativeMetric.completion_rate, LOWER_IS_BETTER_METRICS.has(metric)),
      })
    }
  }
  return rows
}

function buildTargetVsActualTable(monthRoot: EnrichedBizDataNode | null, cumulativeRoot: EnrichedBizDataNode | null, reportTypes: ReportType[]) {
  return reportTypes.flatMap(reportType => [
    buildTargetVsActualRow(monthRoot, reportType, 'monthly'),
    buildTargetVsActualRow(cumulativeRoot, reportType, 'cumulative'),
  ])
}

function buildCompositionRows(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], reportType: ReportType): CompositionRow[] {
  if (!root) return []
  const children = getChildren(root, allNodes)
  const totalRevenue = root.metrics.revenue?.actual ?? null
  const totalProfit = root.metrics.pretax_profit?.actual ?? null

  return children.map(child => {
    const revenue = child.metrics.revenue
    const profit = child.metrics.pretax_profit
    const revenueCompletion = reportType === 'fone' ? revenue?.completion_fone ?? null : revenue?.completion_tuwei ?? null
    const profitCompletion = reportType === 'fone' ? profit?.completion_fone ?? null : profit?.completion_tuwei ?? null

    return {
      level_1: child.orgHierarchy.level_1,
      level_2: child.orgHierarchy.level_2,
      node_name: child.node_name,
      node_kind: getNodeKind(child),
      revenue_actual: revenue?.actual ?? null,
      revenue_share: contributionShare(revenue?.actual ?? null, totalRevenue),
      revenue_completion_rate: revenueCompletion,
      pretax_profit_actual: profit?.actual ?? null,
      pretax_profit_share: contributionShare(profit?.actual ?? null, totalProfit),
      pretax_profit_completion_rate: profitCompletion,
      business_judgement: `收入完成率${formatPctForJudgement(revenueCompletion)}，税前利润完成率${formatPctForJudgement(profitCompletion)}。`,
    }
  })
}

function buildCompositionRow(
  node: EnrichedBizDataNode,
  root: EnrichedBizDataNode | null,
  reportType: ReportType,
  label?: string
): CompositionRow {
  const revenue = node.metrics.revenue
  const profit = node.metrics.pretax_profit
  const totalRevenue = root?.metrics.revenue?.actual ?? null
  const totalProfit = root?.metrics.pretax_profit?.actual ?? null
  const revenueCompletion = reportType === 'fone' ? revenue?.completion_fone ?? null : revenue?.completion_tuwei ?? null
  const profitCompletion = reportType === 'fone' ? profit?.completion_fone ?? null : profit?.completion_tuwei ?? null

  return {
    level_1: node.orgHierarchy.level_1,
    level_2: node.orgHierarchy.level_2,
    node_name: node.node_name,
    node_kind: getNodeKind(node),
    revenue_actual: revenue?.actual ?? null,
    revenue_share: contributionShare(revenue?.actual ?? null, totalRevenue),
    revenue_completion_rate: revenueCompletion,
    pretax_profit_actual: profit?.actual ?? null,
    pretax_profit_share: contributionShare(profit?.actual ?? null, totalProfit),
    pretax_profit_completion_rate: profitCompletion,
    business_judgement: `${label ? `${label}：` : ''}收入完成率${formatPctForJudgement(revenueCompletion)}，税前利润完成率${formatPctForJudgement(profitCompletion)}。`,
  }
}

function buildKeyDescendantRows(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], reportType: ReportType): CompositionRow[] {
  if (!root) return []
  const descendants = flattenSubtree(root, allNodes).filter(node => node.node_name !== root.node_name)
  const seen = new Set<string>()
  const addRows = (nodes: EnrichedBizDataNode[], label: string) => nodes
    .filter(node => {
      const key = `${getNodeKind(node)}:${node.node_name}:${node.orgHierarchy.level_1 ?? ''}:${node.orgHierarchy.level_2 ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(node => buildCompositionRow(node, root, reportType, label))

  const revenueContribution = [...descendants]
    .filter(node => node.metrics.revenue?.actual != null)
    .sort((a, b) => (b.metrics.revenue?.actual ?? 0) - (a.metrics.revenue?.actual ?? 0))
    .slice(0, 8)
  const profitGap = [...descendants]
    .filter(node => {
      const diffValue = reportType === 'fone'
        ? node.metrics.pretax_profit?.diff_fone
        : node.metrics.pretax_profit?.diff_tuwei
      return diffValue != null
    })
    .sort((a, b) => {
      const left = reportType === 'fone' ? a.metrics.pretax_profit?.diff_fone : a.metrics.pretax_profit?.diff_tuwei
      const right = reportType === 'fone' ? b.metrics.pretax_profit?.diff_fone : b.metrics.pretax_profit?.diff_tuwei
      return (left ?? 0) - (right ?? 0)
    })
    .slice(0, 8)

  return [
    ...addRows(revenueContribution, '收入贡献重点'),
    ...addRows(profitGap, '利润缺口重点'),
  ].slice(0, 16)
}

function buildLeafExceptionRows(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], reportType: ReportType): CompositionRow[] {
  if (!root) return []
  return flattenSubtree(root, allNodes)
    .filter(node => {
      if (node.node_name === root.node_name) return false
      if (getNodeKind(node) !== 'leaf' && getNodeKind(node) !== 'orphan') return false
      const profitCompletion = reportType === 'fone'
        ? node.metrics.pretax_profit?.completion_fone
        : node.metrics.pretax_profit?.completion_tuwei
      const revenueCompletion = reportType === 'fone'
        ? node.metrics.revenue?.completion_fone
        : node.metrics.revenue?.completion_tuwei
      return (profitCompletion != null && profitCompletion < 0.8)
        || (revenueCompletion != null && revenueCompletion < 0.8)
        || (node.metrics.pretax_profit?.actual ?? 0) < 0
    })
    .sort((a, b) => {
      const left = reportType === 'fone' ? a.metrics.pretax_profit?.completion_fone : a.metrics.pretax_profit?.completion_tuwei
      const right = reportType === 'fone' ? b.metrics.pretax_profit?.completion_fone : b.metrics.pretax_profit?.completion_tuwei
      return (left ?? Number.POSITIVE_INFINITY) - (right ?? Number.POSITIVE_INFINITY)
    })
    .map(node => buildCompositionRow(node, root, reportType, '叶子节点异常'))
}

function buildOrganizationTwoLevelTable(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[]): OrganizationCoverageRow[] {
  return collectSubtreeWithDepth(root, allNodes, 2).map(({ node, depth }) => ({
    node_name: node.node_name,
    node_kind: getNodeKind(node),
    level_1: node.orgHierarchy.level_1,
    level_2: node.orgHierarchy.level_2,
    depth_from_scope: depth,
    child_count: getChildren(node, allNodes).length,
    revenue_actual: node.metrics.revenue?.actual ?? null,
    pretax_profit_actual: node.metrics.pretax_profit?.actual ?? null,
    labor_cost_actual: node.metrics.labor_cost?.actual ?? null,
    gross_margin_actual: node.metrics.gross_margin?.actual ?? null,
  }))
}

function buildAllMetricRows(params: {
  root: EnrichedBizDataNode | null
  allNodes: EnrichedBizDataNode[]
  reportTypes: ReportType[]
  periodScope: PeriodScope
  labelMap: Map<MetricCategory, string>
}): OrganizationMetricRow[] {
  return collectSubtreeWithDepth(params.root, params.allNodes).flatMap(({ node, depth }) =>
    params.reportTypes.flatMap(reportType =>
      ALL_REPORT_METRICS.map(metric => ({
        ...metricValue(node, metric, reportType, params.labelMap),
        report_type: reportType,
        period_scope: params.periodScope,
        node_name: node.node_name,
        node_kind: getNodeKind(node),
        level_1: node.orgHierarchy.level_1,
        level_2: node.orgHierarchy.level_2,
        depth_from_scope: depth,
        within_required_two_levels: depth <= 2,
      }))
    )
  )
}

function findNodeByName(nodes: EnrichedBizDataNode[], nodeName: string): EnrichedBizDataNode | null {
  return nodes.find(node => node.node_name === nodeName) ?? null
}

function buildUnitCards(params: {
  monthRoot: EnrichedBizDataNode | null
  previousRoot: EnrichedBizDataNode | null
  cumulativeRoot: EnrichedBizDataNode | null
  monthNodes: EnrichedBizDataNode[]
  cumulativeNodes: EnrichedBizDataNode[]
  reportType: ReportType
  maxUnits: number
}): UnitCard[] {
  const cumulativeSubtree = flattenSubtree(params.cumulativeRoot, params.cumulativeNodes)
  const candidates = cumulativeSubtree
    .filter(node => node.node_name !== params.cumulativeRoot?.node_name)
    .map(node => {
      const revenue = node.metrics.revenue
      const profit = node.metrics.pretax_profit
      const revenueCompletion = params.reportType === 'fone' ? revenue?.completion_fone : revenue?.completion_tuwei
      const profitCompletion = params.reportType === 'fone' ? profit?.completion_fone : profit?.completion_tuwei
      const revenueDiff = params.reportType === 'fone' ? revenue?.diff_fone : revenue?.diff_tuwei
      const profitDiff = params.reportType === 'fone' ? profit?.diff_fone : profit?.diff_tuwei
      const expenseOverrun = COST_EXPENSE_DETAIL_METRICS.reduce((sum, metric) => {
        const value = node.metrics[metric]
        const diffValue = params.reportType === 'fone' ? value?.diff_fone : value?.diff_tuwei
        return sum + Math.max(0, diffValue ?? 0)
      }, 0)
      const riskScore = [
        profitCompletion != null && profitCompletion < 0.8 ? 40 : 0,
        revenueCompletion != null && revenueCompletion < 0.8 ? 25 : 0,
        (profit?.actual ?? 0) < 0 ? 35 : 0,
        expenseOverrun > 0 ? 15 : 0,
      ].reduce((sum, value) => sum + value, 0)
      const contributionScore = Math.abs(revenue?.actual ?? 0) + Math.abs(profit?.actual ?? 0)
      const gapScore = Math.abs(Math.min(0, revenueDiff ?? 0)) + Math.abs(Math.min(0, profitDiff ?? 0))
      const selectionScore = riskScore * 1_000_000 + gapScore * 1_000 + contributionScore
      const selectionReason = riskScore > 0
        ? '风险优先'
        : gapScore > 0
          ? '缺口优先'
          : contributionScore > 0
            ? '贡献优先'
            : '层级覆盖'

      return { node, selectionScore, selectionReason }
    })
    .sort((a, b) => b.selectionScore - a.selectionScore)

  return candidates
    .slice(0, params.maxUnits)
    .map(({ node, selectionReason }) => {
      const monthlyNode = findNodeByName(params.monthNodes, node.node_name)
      const monthlyRow = buildTargetVsActualRow(monthlyNode, params.reportType, 'monthly')
      const cumulativeRow = buildTargetVsActualRow(node, params.reportType, 'cumulative')
      const warnings: string[] = []
      if ((cumulativeRow.revenue_completion_rate ?? 1) < 0.8) warnings.push('累计收入完成率低于80%，需关注收入兑现节奏。')
      if ((cumulativeRow.pretax_profit_completion_rate ?? 1) < 0.8) warnings.push('累计税前利润完成率低于80%，需关注利润转化和成本刚性。')
      if ((monthlyRow.pretax_profit_actual ?? 0) < 0) warnings.push('当月税前利润为负，需复核项目毛利和费用确认。')
      const cumulativeCostMetrics = COST_EXPENSE_METRICS
        .map(metric => metricValue(node, metric, params.reportType, new Map(Object.entries(FALLBACK_METRIC_LABELS) as Array<[MetricCategory, string]>)))
        .filter(metric => metric.actual != null || metric.target != null || metric.completion_rate != null)
      const highExpenseMetrics = cumulativeCostMetrics.filter(metric => (metric.completion_rate ?? 0) > 1.1)
      if (highExpenseMetrics.length > 0) {
        warnings.push(`累计成本费用超预算项：${highExpenseMetrics.map(metric => metric.metric_label).join('、')}。`)
      }

      return {
        node_name: node.node_name,
        node_kind: getNodeKind(node),
        level_1: node.orgHierarchy.level_1,
        level_2: node.orgHierarchy.level_2,
        selection_reason: selectionReason,
        cumulative: cumulativeRow,
        monthly: monthlyRow,
        cost_expense_metrics: cumulativeCostMetrics,
        warnings,
        suggested_analysis_points: [
          '对照收入完成率与税前利润完成率，判断规模兑现和利润转化是否匹配。',
          '结合成本费用明细，区分人力刚性、餐饮/物资成本和重点费用超支压力。',
        ],
      }
    })
}

function buildScopeProfile(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[]): ScopeProfile {
  const descendants = flattenSubtree(root, allNodes).filter(node => node.node_name !== root?.node_name)
  const directChildren = root ? getChildren(root, allNodes) : []
  const leafCount = descendants.filter(node => {
    const kind = getNodeKind(node)
    return kind === 'leaf' || kind === 'orphan'
  }).length
  const nodeKind = root ? getNodeKind(root) : 'missing'
  const recommendedReportFocus = nodeKind === 'total'
    ? ['集团结构与贡献', '区域/中心差异', '重点缺口和费用风险']
    : nodeKind === 'level1'
      ? ['下属中心/业务单元完成情况', '重点项目拖累点', '费用与利润转化']
      : nodeKind === 'level2'
        ? ['明细单位完成情况', '低毛利和费用超支节点', '当月对累计目标影响']
        : ['本节点目标达成', '当月/累计趋势', '费用和人工补充事项']

  return {
    scope_name: root?.node_name ?? '未匹配节点',
    node_kind: nodeKind,
    level_1: root?.orgHierarchy.level_1 ?? null,
    level_2: root?.orgHierarchy.level_2 ?? null,
    direct_child_count: directChildren.length,
    descendant_count: descendants.length,
    leaf_count: leafCount,
    recommended_report_focus: recommendedReportFocus,
  }
}

function getAvailableFields(row: TargetVsActualRow): string[] {
  return Object.entries(row)
    .filter(([key, value]) => key !== 'node_name' && key !== 'report_type' && key !== 'period_scope' && value != null)
    .map(([key]) => key)
}

function buildDataCompletenessMatrix(params: {
  targetVsActualTable: TargetVsActualRow[]
  compositionTable: CompositionRow[]
  unitCards: UnitCard[]
  costExpenseTable: CostExpenseRow[]
  coverage: BusinessReportPack['coverage']
  metricCoverage: MetricCoverage
}): DataCompletenessMatrixRow[] {
  const targetRows = params.targetVsActualTable
  const requiredTargetFields = [
    'revenue_actual',
    'revenue_target',
    'revenue_completion_rate',
    'revenue_diff',
    'pretax_profit_actual',
    'pretax_profit_target',
    'pretax_profit_completion_rate',
    'pretax_profit_diff',
  ]
  const matrix: DataCompletenessMatrixRow[] = []

  for (const periodScope of ['monthly', 'cumulative'] as const) {
    for (const reportType of ['fone', 'tuwei'] as const) {
      const row = targetRows.find(item => item.period_scope === periodScope && item.report_type === reportType)
      const availableFields = row ? getAvailableFields(row) : []
      const missingFields = requiredTargetFields.filter(field => !availableFields.includes(field))
      matrix.push({
        section: '目标对标总表',
        period_scope: periodScope,
        report_type: reportType,
        required_fields: requiredTargetFields,
        status: !row ? 'missing' : missingFields.length === 0 ? 'available' : 'partial',
        missing_fields: missingFields,
        handling: missingFields.length === 0 ? '可直接写入报告' : '写作时降低结论强度，并提示缺失字段',
      })
    }
  }

  matrix.push({
    section: '明细构成与贡献',
    period_scope: 'cumulative',
    report_type: 'both',
    required_fields: ['composition_table', 'variance_rankings', 'unit_cards'],
    status: params.compositionTable.length > 0 && params.unitCards.length > 0 ? 'available' : 'partial',
    missing_fields: [
      params.compositionTable.length > 0 ? '' : 'composition_table',
      params.unitCards.length > 0 ? '' : 'unit_cards',
    ].filter(Boolean),
    handling: '优先使用直接子级表；若子级不足，使用重点后代和叶子异常表补充',
  })

  matrix.push({
    section: '成本费用参考',
    period_scope: 'cross_period',
    report_type: 'both',
    required_fields: COST_EXPENSE_METRICS,
    status: params.costExpenseTable.length > 0 ? 'available' : 'missing',
    missing_fields: params.costExpenseTable.length > 0 ? [] : COST_EXPENSE_METRICS,
    handling: '系统可取费用指标必须先输出，不能写成专项待补',
  })

  matrix.push({
    section: '自动指标覆盖',
    period_scope: 'cross_period',
    report_type: 'both',
    required_fields: params.metricCoverage.expected_auto_metrics,
    status: params.metricCoverage.missing_auto_metrics.length === 0 ? 'available' : 'partial',
    missing_fields: params.metricCoverage.missing_auto_metrics,
    handling: params.metricCoverage.missing_auto_metrics.length === 0 ? '核心自动指标均有返回记录' : '关键指标缺失时需降低结论强度',
  })

  for (const gap of params.coverage.gaps) {
    matrix.push({
      section: gap.section,
      period_scope: 'manual',
      report_type: 'not_applicable',
      required_fields: gap.field.split('/'),
      status: 'manual_required',
      missing_fields: gap.field.split('/'),
      handling: '在报告结尾集中说明需人工补充，禁止编造；正文不渲染大面积占位表',
    })
  }

  return matrix
}

function formatBriefNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '无数据'
  return value.toFixed(2)
}

function formatBriefPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '无数据'
  return `${(value * 100).toFixed(1)}%`
}

function periodScopeLabel(scope: PeriodScope): string {
  return scope === 'monthly' ? '当月' : '累计'
}

function reportTypeLabel(reportType: ReportType): string {
  return reportType === 'fone' ? '年初预算口径' : '突围考核口径'
}

function buildWritingBrief(params: {
  scopeProfile: BusinessReportPack['scope_profile']
  summaryCards: BusinessReportPack['summary_cards']
  targetVsActualTable: BusinessReportPack['target_vs_actual_table']
  directChildrenTable: BusinessReportPack['direct_children_table']
  unitCards: BusinessReportPack['unit_cards']
  costExpenseSummary: BusinessReportPack['cost_expense_summary']
  varianceRankings: BusinessReportPack['variance_rankings']
  warnings: BusinessReportPack['warnings']
}): BusinessReportWritingBrief {
  const targetRows = params.targetVsActualTable
    .filter(row => row.report_type === 'tuwei' || row.report_type === 'fone')
    .slice(0, 4)

  const executiveSummaryPoints = targetRows.map(row => {
    const label = `${reportTypeLabel(row.report_type)}${periodScopeLabel(row.period_scope)}`
    return `${label}：营业收入${formatBriefNumber(row.revenue_actual)}万元，完成率${formatBriefPct(row.revenue_completion_rate)}，差额${formatBriefNumber(row.revenue_diff)}万元；税前利润${formatBriefNumber(row.pretax_profit_actual)}万元，完成率${formatBriefPct(row.pretax_profit_completion_rate)}，差额${formatBriefNumber(row.pretax_profit_diff)}万元。`
  })

  const targetGapPoints = [
    ...params.varianceRankings.revenue_gap_top.slice(0, 5).map(row =>
      `${row.node_name}收入缺口${formatBriefNumber(row.diff)}万元，完成率${formatBriefPct(row.completion_rate)}。`
    ),
    ...params.varianceRankings.profit_gap_top.slice(0, 5).map(row =>
      `${row.node_name}税前利润缺口${formatBriefNumber(row.diff)}万元，完成率${formatBriefPct(row.completion_rate)}。`
    ),
  ]

  const structurePoints = params.directChildrenTable.slice(0, 8).map(row =>
    `${row.node_name}收入${formatBriefNumber(row.revenue_actual)}万元，占比${formatBriefPct(row.revenue_share)}，税前利润${formatBriefNumber(row.pretax_profit_actual)}万元，占比${formatBriefPct(row.pretax_profit_share)}。`
  )

  const unitRiskPoints = params.unitCards.slice(0, 8).map(card => {
    const warnings = card.warnings.length ? `风险：${card.warnings.join('；')}` : '暂无红黄风险。'
    return `${card.node_name}（${card.selection_reason || '重点单位'}）：累计收入完成率${formatBriefPct(card.cumulative.revenue_completion_rate)}，累计税前利润完成率${formatBriefPct(card.cumulative.pretax_profit_completion_rate)}，${warnings}`
  })

  const costExpensePoints = [
    ...params.costExpenseSummary
      .filter(row => row.status === 'risk' || row.status === 'watch')
      .slice(0, 8)
      .map(row =>
        `${reportTypeLabel(row.report_type)}${periodScopeLabel(row.period_scope)}${row.metric_label}完成率${formatBriefPct(row.completion_rate)}，差额${formatBriefNumber(row.diff)}万元。`
      ),
    ...params.varianceRankings.expense_over_budget_top.slice(0, 5).map(row =>
      `${row.node_name}${row.metric_label || '费用'}超预算${formatBriefNumber(row.diff)}万元，完成率${formatBriefPct(row.completion_rate)}。`
    ),
  ]

  const riskActionPoints = params.warnings
    .filter(warning => warning.section !== '专项数据覆盖')
    .slice(0, 10)
    .map(warning => `${warning.severity}：${warning.node_name ? `${warning.node_name}，` : ''}${warning.message}`)

  return {
    focus: params.scopeProfile.recommended_report_focus,
    executive_summary_points: executiveSummaryPoints,
    target_gap_points: targetGapPoints,
    structure_points: structurePoints,
    cost_expense_points: costExpensePoints,
    risk_action_points: [...unitRiskPoints, ...riskActionPoints].slice(0, 12),
  }
}

function buildMissingDataNotes(coverage: BusinessReportPack['coverage']): MissingDataNote[] {
  return coverage.gaps.map(gap => ({
    section: gap.section,
    reason: gap.reason,
    fields: gap.field.split('/'),
    handling: 'closing_note',
  }))
}

function rankingRow(
  node: EnrichedBizDataNode,
  metric: MetricCategory,
  reportType: ReportType,
  totalActual: number | null,
  labelMap?: Map<MetricCategory, string>
): RankingRow {
  const value = node.metrics[metric]
  return {
    metric,
    metric_label: labelMap?.get(metric) ?? FALLBACK_METRIC_LABELS[metric],
    node_name: node.node_name,
    node_kind: getNodeKind(node),
    level_1: node.orgHierarchy.level_1,
    level_2: node.orgHierarchy.level_2,
    actual: value?.actual ?? null,
    share: contributionShare(value?.actual ?? null, totalActual),
    diff: reportType === 'fone' ? value?.diff_fone ?? null : value?.diff_tuwei ?? null,
    completion_rate: reportType === 'fone' ? value?.completion_fone ?? null : value?.completion_tuwei ?? null,
  }
}

function buildRankings(
  root: EnrichedBizDataNode | null,
  allNodes: EnrichedBizDataNode[],
  reportType: ReportType,
  labelMap: Map<MetricCategory, string>
) {
  const nodes = flattenSubtree(root, allNodes).filter(node => node.node_name !== root?.node_name)
  const revenueTotal = root?.metrics.revenue?.actual ?? null
  const profitTotal = root?.metrics.pretax_profit?.actual ?? null
  const revenueRows = nodes.map(node => rankingRow(node, 'revenue', reportType, revenueTotal, labelMap))
  const profitRows = nodes.map(node => rankingRow(node, 'pretax_profit', reportType, profitTotal, labelMap))
  const laborCostRows = nodes.map(node => rankingRow(node, 'labor_cost', reportType, root?.metrics.labor_cost?.actual ?? null, labelMap))
  const expenseRows = nodes.flatMap(node =>
    COST_EXPENSE_DETAIL_METRICS
      .filter(metric => metric !== 'labor_cost')
      .map(metric => rankingRow(node, metric, reportType, root?.metrics[metric]?.actual ?? null, labelMap))
  )
  const grossMarginRows = nodes.map(node => rankingRow(node, 'gross_margin', reportType, null, labelMap))

  return {
    revenue_gap_top: revenueRows
      .filter(row => row.diff != null)
      .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))
      .slice(0, 10),
    profit_gap_top: profitRows
      .filter(row => row.diff != null)
      .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))
      .slice(0, 10),
    revenue_contribution_top: revenueRows
      .filter(row => row.actual != null)
      .sort((a, b) => (b.actual ?? 0) - (a.actual ?? 0))
      .slice(0, 10),
    profit_contribution_top: profitRows
      .filter(row => row.actual != null)
      .sort((a, b) => (b.actual ?? 0) - (a.actual ?? 0))
      .slice(0, 10),
    labor_cost_over_budget_top: laborCostRows
      .filter(row => row.diff != null && (row.diff ?? 0) > 0)
      .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0))
      .slice(0, 10),
    expense_over_budget_top: expenseRows
      .filter(row => row.diff != null && (row.diff ?? 0) > 0)
      .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0))
      .slice(0, 10),
    low_gross_margin_top: grossMarginRows
      .filter(row => row.actual != null)
      .sort((a, b) => (a.actual ?? 0) - (b.actual ?? 0))
      .slice(0, 10),
  }
}

function buildCostExpenseRows(params: {
  root: EnrichedBizDataNode | null
  allNodes: EnrichedBizDataNode[]
  reportTypes: ReportType[]
  periodScope: PeriodScope
  labelMap: Map<MetricCategory, string>
}): CostExpenseRow[] {
  if (!params.root) return []
  const nodes = [params.root, ...flattenSubtree(params.root, params.allNodes).filter(node => node.node_name !== params.root?.node_name)]
  const rows: CostExpenseRow[] = []

  for (const node of nodes) {
    for (const reportType of params.reportTypes) {
      for (const metric of COST_EXPENSE_METRICS) {
        const value = metricValue(node, metric, reportType, params.labelMap)
        if (value.actual == null && value.target == null && value.completion_rate == null && value.diff == null) continue
        rows.push({
          ...value,
          report_type: reportType,
          period_scope: params.periodScope,
          node_name: node.node_name,
          node_kind: getNodeKind(node),
          level_1: node.orgHierarchy.level_1,
          level_2: node.orgHierarchy.level_2,
          status: statusByCompletion(value.completion_rate, LOWER_IS_BETTER_METRICS.has(metric)),
        })
      }
    }
  }

  return rows
}

function buildMetricCoverage(reports: EduBizReport[]): MetricCoverage {
  const available = new Set(reports.map(report => report.metric_category))
  const expected = DEFAULT_REPORT_METRICS
  const missing = expected.filter(metric => !available.has(metric))

  return {
    expected_auto_metrics: expected,
    available_auto_metrics: expected.filter(metric => available.has(metric)),
    missing_auto_metrics: missing,
    note: missing.length > 0
      ? '这些自动经营指标本次报告包未返回；生成报告前应优先补查，仍无数据时再降低结论强度。'
      : '核心自动经营指标本次报告包均有返回记录；具体节点上仍可能存在空值。',
  }
}

function buildManualFillSections(): BusinessReportPack['manual_fill_sections'] {
  const receivables: ManualFillSection = {
    status: 'manual_required',
    heading: '应收账款回款情况',
    reason: '当前系统未接入应收账款、回款、账龄和合同维度数据。',
    instructions: ['请业务人员补充期末应收余额、本月应回款、本月已回款、回款率、未回款原因和风险等级。', '补数后需复核回款率、逾期账龄和整改动作。'],
    table_markdown: '| 项目 / 合同类别 | 期末应收余额 | 本月应回款 | 本月已回款 | 回款率 | 未回款金额 | 风险等级 | 原因/备注 |\n|---|---:|---:|---:|---:|---:|---|---|\n| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |',
  }
  const cashPlan: ManualFillSection = {
    status: 'manual_required',
    heading: '资金计划执行情况',
    reason: '当前系统未接入资金计划预算、实际收支、现金净流量和奖惩测算数据。',
    instructions: ['请业务人员补充资金计划、实际资金收入/支出、差异率、奖惩金额、现金净流量和偏差原因。', '补数后需复核现金流偏差对当月经营判断的影响。'],
    table_markdown: '| 分类 | 月份 | 资金计划 | 实际资金收入/支出 | 差异率 | 奖惩金额 | 现金净流量 | 偏差原因 |\n|---|---|---:|---:|---:|---:|---:|---|\n| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |',
  }
  const coreExpenses: ManualFillSection = {
    status: 'manual_required',
    heading: '当月核心费用支出情况',
    reason: '当前系统未接入业务报告所需核心费用专项明细，如办公用品费、咨询/维修/服务费等。',
    instructions: ['系统已有部分费用类经营指标只能作为参考，不能替代该专项表。', '请业务人员补充核心费用明细、预算/额度、偏差和风险判断。'],
    table_markdown: '| 分析单元 | 招待费 | 办公用品费 | 咨询/维修/服务费 | 其他重点费用 | 当月合计 | 预算/额度 | 偏差 | 风险判断 |\n|---|---:|---:|---:|---:|---:|---:|---:|---|\n| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |',
  }
  return { receivables, cash_plan: cashPlan, core_expenses: coreExpenses }
}

function buildWarnings(params: {
  unitCards: UnitCard[]
  summaryCards: SummaryCard[]
  costExpenseRows: CostExpenseRow[]
}): BusinessReportWarning[] {
  const warnings: BusinessReportWarning[] = []
  params.summaryCards
    .filter(card => card.status === 'risk' || card.status === 'watch' || card.status === 'missing')
    .forEach(card => {
      warnings.push({
        severity: card.status === 'risk' ? 'red' : card.status === 'watch' ? 'yellow' : 'info',
        section: card.period_scope === 'monthly' ? '当月核心指标' : '累计核心指标',
        message: `${card.report_type} ${card.metric_label}${card.period_scope === 'monthly' ? '当月' : '累计'}完成状态为 ${card.status}。`,
        evidence: {
          metric: card.metric,
          actual: card.actual,
          target: card.target,
          completion_rate: card.completion_rate,
          diff: card.diff,
        },
      })
    })

  params.unitCards.forEach(card => {
    card.warnings.forEach(message => {
      warnings.push({
        severity: message.includes('低于80%') || message.includes('为负') ? 'red' : 'yellow',
        section: '区域/中心完成情况',
        node_name: card.node_name,
        message,
        evidence: {
          cumulative: card.cumulative,
          monthly: card.monthly,
        },
      })
    })
  })

  params.costExpenseRows
    .filter(row => (row.status === 'risk' || row.status === 'watch') && row.diff != null)
    .slice(0, 20)
    .forEach(row => {
      warnings.push({
        severity: row.status === 'risk' ? 'red' : 'yellow',
        section: row.period_scope === 'monthly' ? '当月成本费用' : '累计成本费用',
        node_name: row.node_name,
        message: `${row.report_type} ${row.node_name}${row.period_scope === 'monthly' ? '当月' : '累计'}${row.metric_label}完成状态为 ${row.status}。`,
        evidence: {
          metric: row.metric,
          actual: row.actual,
          target: row.target,
          completion_rate: row.completion_rate,
          diff: row.diff,
        },
      })
    })

  warnings.push({
    severity: 'info',
    section: '专项数据覆盖',
    message: '应收账款回款、资金计划执行、核心费用专项明细当前均需人工补充，禁止自动编造。',
    evidence: {
      receivables: 'manual_required',
      cash_plan: 'manual_required',
      core_expenses: 'manual_required',
    },
  })

  return warnings
}

function buildCoverage(params: {
  monthReports: EduBizReport[]
  previousReports: EduBizReport[]
  cumulativeReports: EduBizReport[]
  monthlyPlanCount: number
}): BusinessReportPack['coverage'] {
  const hasMonthly = params.monthReports.length > 0
  const hasPrevious = params.previousReports.length > 0
  const hasCumulative = params.cumulativeReports.length > 0
  const availableCount = [hasMonthly, hasPrevious, hasCumulative].filter(Boolean).length
  return {
    core_biz_data: availableCount === 3 ? 'available' : availableCount > 0 ? 'partial' : 'missing',
    monthly_plan: params.monthlyPlanCount > 0 ? 'available' : 'missing',
    receivables: 'manual_required',
    cash_plan: 'manual_required',
    core_expenses: 'manual_required',
    gaps: [
      { section: '应收账款回款情况', field: '应收/回款/账龄/合同', reason: '系统未接入专项数据源', handling: 'manual_placeholder' },
      { section: '资金计划执行情况', field: '资金计划/实际收支/现金净流量/奖惩', reason: '系统未接入专项数据源', handling: 'manual_placeholder' },
      { section: '当月核心费用支出情况', field: '办公用品费/咨询维修服务费等专项明细', reason: '系统未接入专项数据源', handling: 'manual_placeholder' },
    ],
  }
}

export const queryBusinessReportPackTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_business_report_pack',
      description:
        '生成完整月度经营分析报告所需的数据包。一次性返回 fone/tuwei、当月/上月/累计、全量指标明细、提问组织下至少两层组织数据、组织构成、差异排行、风险预警和人工补充章节占位。适用于经营分析报告、月报、汇报材料。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称。传空字符串表示集团整体/整棵树。',
          },
          month: {
            type: 'string',
            description: '目标月份，必须使用 Runtime Data Context 中合法 monthly period，例如 202603。',
          },
          previous_month: {
            type: 'string',
            description: '上月月份。可不传，工具会从 month 推断，例如 202603 -> 202602。',
          },
          cumulative_period: {
            type: 'string',
            description: '累计期间，必须使用 Runtime Data Context 中合法 cumulative period。',
          },
          report_types: {
            type: 'array',
            description: '报表口径，默认同时返回 fone 和 tuwei。',
            items: { type: 'string', enum: ['fone', 'tuwei'] },
          },
          max_units: {
            type: 'number',
            description: '最多返回多少个 unit_cards，默认 60。',
          },
        },
        required: ['month', 'cumulative_period'],
      } as ToolDefinition['function']['parameters'],
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const validated = validateArgs(args)
    if (!validated.ok) return JSON.stringify({ error: validated.message }, null, 2)

    const nodeName = validated.values.node_name ?? ''
    const month = validated.values.month
    const previousMonth = validated.values.previous_month || inferPreviousMonth(month)
    const cumulativePeriod = validated.values.cumulative_period
    const reportTypes: ReportType[] = validated.values.report_types?.length ? validated.values.report_types : ['fone', 'tuwei']
    const maxUnits = validated.values.max_units ?? 60

    const [monthReports, previousReports, cumulativeReports, monthlyPlans] = await Promise.all([
      fetchBizReport({ period: month, periodType: 'monthly', reportTypes }),
      fetchBizReport({ period: previousMonth, periodType: 'monthly', reportTypes }),
      fetchBizReport({ period: cumulativePeriod, periodType: 'cumulative', reportTypes }),
      fetchMonthlyPlan(),
    ])

    const labelMap = buildMetricLabelMap([...monthReports, ...previousReports, ...cumulativeReports])
    const monthNodes = aggregateReportNodes(monthReports, monthlyPlans)
    const previousNodes = aggregateReportNodes(previousReports, monthlyPlans)
    const cumulativeNodes = aggregateReportNodes(cumulativeReports, monthlyPlans)

    const cumulativeResolved = resolveRootNode(cumulativeNodes, nodeName)
    if (!cumulativeResolved.ok) {
      return JSON.stringify({
        message: cumulativeResolved.message,
        query_echo: { node_name: nodeName, month, previous_month: previousMonth, cumulative_period: cumulativePeriod, report_types: reportTypes },
        candidates: cumulativeResolved.candidates,
      }, null, 2)
    }

    const resolvedNodeName = cumulativeResolved.root?.node_name ?? nodeName
    const monthResolved = resolveRootNode(monthNodes, resolvedNodeName)
    const previousResolved = resolveRootNode(previousNodes, resolvedNodeName)
    const monthRoot = monthResolved.ok ? monthResolved.root : null
    const previousRoot = previousResolved.ok ? previousResolved.root : null
    const cumulativeRoot = cumulativeResolved.root

    if (!monthRoot && !cumulativeRoot) {
      return JSON.stringify({
        message: '未找到可用于生成报告的经营数据',
        query_echo: { node_name: nodeName, month, previous_month: previousMonth, cumulative_period: cumulativePeriod, report_types: reportTypes },
      }, null, 2)
    }

    const preferredReportType: ReportType = reportTypes.includes('tuwei') ? 'tuwei' : reportTypes[0]
    const summaryCards = buildSummaryCards({ monthRoot, previousRoot, cumulativeRoot, reportTypes, labelMap })
    const targetVsActualTable = buildTargetVsActualTable(monthRoot, cumulativeRoot, reportTypes)
    const directChildrenTable = buildCompositionRows(cumulativeRoot, cumulativeResolved.allNodes, preferredReportType)
    const organizationTwoLevelTable = buildOrganizationTwoLevelTable(cumulativeRoot, cumulativeResolved.allNodes)
    const keyDescendantTable = buildKeyDescendantRows(cumulativeRoot, cumulativeResolved.allNodes, preferredReportType)
    const leafExceptionTable = buildLeafExceptionRows(cumulativeRoot, cumulativeResolved.allNodes, preferredReportType)
    const costExpenseSummary = [
      ...buildCostExpenseRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: cumulativeRoot,
        allNodes: cumulativeResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative',
        labelMap,
      }),
    ].filter(row => row.node_name === (cumulativeRoot?.node_name ?? monthRoot?.node_name))
    const costExpenseTable = [
      ...buildCostExpenseRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: cumulativeRoot,
        allNodes: cumulativeResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative',
        labelMap,
      }),
    ]
    const allMetricTable = [
      ...buildAllMetricRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildAllMetricRows({
        root: cumulativeRoot,
        allNodes: cumulativeResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative',
        labelMap,
      }),
    ]
    const unitCards = buildUnitCards({
      monthRoot,
      previousRoot,
      cumulativeRoot,
      monthNodes: monthResolved.ok ? monthResolved.allNodes : [],
      cumulativeNodes: cumulativeResolved.allNodes,
      reportType: preferredReportType,
      maxUnits,
    })
    const coverage = buildCoverage({
      monthReports,
      previousReports,
      cumulativeReports,
      monthlyPlanCount: monthlyPlans.length,
    })
    const metricCoverage = buildMetricCoverage([...monthReports, ...previousReports, ...cumulativeReports])
    const dataCompletenessMatrix = buildDataCompletenessMatrix({
      targetVsActualTable,
      compositionTable: directChildrenTable,
      unitCards,
      costExpenseTable,
      coverage,
      metricCoverage,
    })
    const warnings = buildWarnings({ unitCards, summaryCards, costExpenseRows: costExpenseTable })
    const scopeProfile = buildScopeProfile(cumulativeRoot ?? monthRoot, cumulativeResolved.allNodes)
    const varianceRankings = buildRankings(cumulativeRoot, cumulativeResolved.allNodes, preferredReportType, labelMap)
    const writingBrief = buildWritingBrief({
      scopeProfile,
      summaryCards,
      targetVsActualTable,
      directChildrenTable,
      unitCards,
      costExpenseSummary,
      varianceRankings,
      warnings,
    })

    const pack: BusinessReportPack = {
      metadata: {
        scope_name: cumulativeRoot?.node_name ?? monthRoot?.node_name ?? (nodeName || '智汇后勤集团'),
        month,
        previous_month: previousMonth,
        cumulative_period: cumulativePeriod,
        generated_at: new Date().toISOString(),
        unit: '万元',
        row_counts: {
          organization_two_level_table: organizationTwoLevelTable.length,
          all_metric_table: allMetricTable.length,
          cost_expense_table: costExpenseTable.length,
          unit_cards: unitCards.length,
          warnings: warnings.length,
        },
      },
      scope_profile: scopeProfile,
      writing_brief: writingBrief,
      coverage,
      summary_cards: summaryCards,
      target_vs_actual_table: targetVsActualTable,
      composition_table: directChildrenTable,
      direct_children_table: directChildrenTable,
      organization_two_level_table: organizationTwoLevelTable,
      all_metric_table: allMetricTable,
      key_descendant_table: keyDescendantTable,
      leaf_exception_table: leafExceptionTable,
      unit_cards: unitCards,
      monthly_actual_table: reportTypes.map(reportType => buildTargetVsActualRow(monthRoot, reportType, 'monthly')),
      cost_expense_summary: costExpenseSummary,
      cost_expense_table: costExpenseTable,
      data_completeness_matrix: dataCompletenessMatrix,
      metric_coverage: metricCoverage,
      missing_data_notes: buildMissingDataNotes(coverage),
      variance_rankings: varianceRankings,
      manual_fill_sections: buildManualFillSections(),
      warnings,
    }

    return JSON.stringify(pack, null, 2)
  },
}
