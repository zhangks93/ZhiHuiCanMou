import type { RegisteredTool, ToolDefinition } from '../types'
import type { EduBizReport, EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import {
  aggregateByNode,
  buildOrgPath,
  buildOrgScopeKey,
  buildTreeWithAggregation,
  fetchBizReport,
  findHierarchyNodeByScopeKey,
  findHierarchyNodeMatches,
  getChildren,
  getNodeKind,
} from '@/features/biz-data/services/bizDataService'
import {
  contributionShare,
  DEFAULT_REPORT_METRICS,
  assessGoalProbability,
  formatPctForJudgement,
  inferCumulativeToMonthPeriod,
  inferPreviousMonth,
  inferSchoolYearTargetPeriod,
  LOWER_IS_BETTER_METRICS,
  schoolYearProgressRate,
  statusByCompletion,
} from './reportCalculations'
import {
  buildBusinessReportClaimRules,
  buildBusinessReportEvidenceLedger,
  buildBusinessReportQualityContract,
  buildBusinessReportRenderHints,
  buildBusinessReportSectionBriefs,
  validateBusinessReportPack,
} from './businessReportQuality'
import type {
  BusinessReportPack,
  BusinessReportWarning,
  BusinessReportWritingBrief,
  CompositionRow,
  CostExpenseRow,
  CostExpenseWideRow,
  DataCompletenessMatrixRow,
  ManualFillSection,
  MetricComparisonWideRow,
  MissingDataNote,
  MetricCoverage,
  PeriodScope,
  RankingRow,
  ReportMetricValue,
  ReportType,
  OrganizationCoverageRow,
  OrganizationMetricRow,
  ScopeProfile,
  SchoolYearGoalAssessmentRow,
  SummaryCard,
  TargetVsActualRow,
  UnitCard,
} from './reportPackTypes'

type QueryBusinessReportPackArgs = {
  node_name?: string
  org_scope_key?: string
  month: string
  previous_month?: string
  cumulative_period?: string
  school_year_target_period?: string
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
const CORE_TARGET_METRICS: Array<'revenue' | 'pretax_profit'> = ['revenue', 'pretax_profit']

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
  const schoolYearTargetPeriod = args.school_year_target_period
  const previousMonth = args.previous_month
  const nodeName = args.node_name
  const orgScopeKey = args.org_scope_key
  const reportTypes = args.report_types
  const maxUnits = args.max_units

  if (nodeName !== undefined && typeof nodeName !== 'string') {
    return { ok: false, message: 'node_name 如传入，必须为字符串；传空字符串表示集团整体' }
  }

  if (orgScopeKey !== undefined && (typeof orgScopeKey !== 'string' || !orgScopeKey.trim())) {
    return { ok: false, message: 'org_scope_key 如传入，必须为非空字符串' }
  }

  if (typeof month !== 'string' || !month.trim()) {
    return { ok: false, message: 'month 必须为非空字符串，且必须使用 Runtime Data Context 中合法 monthly period' }
  }

  if (previousMonth !== undefined && (typeof previousMonth !== 'string' || !previousMonth.trim())) {
    return { ok: false, message: 'previous_month 如传入，必须为非空字符串' }
  }

  if (cumulativePeriod !== undefined && (typeof cumulativePeriod !== 'string' || !cumulativePeriod.trim())) {
    return { ok: false, message: 'cumulative_period 如传入，必须为非空字符串，且必须使用 Runtime Data Context 中合法 cumulative period' }
  }

  if (schoolYearTargetPeriod !== undefined && (typeof schoolYearTargetPeriod !== 'string' || !schoolYearTargetPeriod.trim())) {
    return { ok: false, message: 'school_year_target_period 如传入，必须为非空字符串，且必须使用 Runtime Data Context 中合法 cumulative period' }
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
      org_scope_key: orgScopeKey?.trim(),
      month: month.trim(),
      previous_month: previousMonth?.trim(),
      cumulative_period: cumulativePeriod?.trim(),
      school_year_target_period: schoolYearTargetPeriod?.trim(),
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

function aggregateReportNodes(reports: EduBizReport[]): EnrichedBizDataNode[] {
  const foneReports = reports.filter(row => row.report_type === 'fone')
  const tuweiReports = reports.filter(row => row.report_type === 'tuwei')
  return aggregateByNode(foneReports, tuweiReports, [])
}

function resolveRootNode(nodes: EnrichedBizDataNode[], nodeName: string, orgScopeKey?: string):
  | { ok: true; root: EnrichedBizDataNode | null; allNodes: EnrichedBizDataNode[] }
  | { ok: false; message: string; candidates?: unknown[] } {
  if (!nodes.length) return { ok: true, root: null, allNodes: [] }

  const allNodes = buildTreeWithAggregation(nodes)
  if (orgScopeKey) {
    const scopedRoot = findHierarchyNodeByScopeKey(nodes, orgScopeKey)
    if (!scopedRoot) return { ok: false, message: '未找到匹配 org_scope_key 的组织节点' }
    return {
      ok: true,
      root: allNodes.find(node => buildOrgScopeKey(node) === buildOrgScopeKey(scopedRoot)) ?? scopedRoot,
      allNodes,
    }
  }

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
        org_scope_key: buildOrgScopeKey(match.node),
        org_path: buildOrgPath(match.node),
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
  const actual = reportType === 'fone'
    ? value?.actual_fone ?? value?.actual ?? null
    : value?.actual_tuwei ?? value?.actual ?? null
  const previousActual = reportType === 'fone'
    ? previousValue?.actual_fone ?? previousValue?.actual
    : previousValue?.actual_tuwei ?? previousValue?.actual
  const yoy = reportType === 'fone'
    ? value?.yoy_fone ?? value?.yoy ?? null
    : value?.yoy_tuwei ?? value?.yoy ?? null

  return {
    metric,
    metric_label: labelMap.get(metric) ?? metric,
    actual,
    actual_fone: value?.actual_fone ?? value?.actual ?? null,
    actual_tuwei: value?.actual_tuwei ?? value?.actual ?? null,
    target: target ?? null,
    completion_rate: completionRate ?? null,
    diff: diff ?? null,
    yoy,
    yoy_fone: value?.yoy_fone ?? value?.yoy ?? null,
    yoy_tuwei: value?.yoy_tuwei ?? value?.yoy ?? null,
    mom: actual != null && previousActual != null ? actual - previousActual : null,
  }
}

function reportTypeLabel(reportType: ReportType): string {
  return reportType === 'fone' ? '学年预算' : '突围考核'
}

function periodScopeLabel(scope: PeriodScope): string {
  if (scope === 'monthly') return '当月'
  if (scope === 'school_year_target') return '学年目标累计'
  return '截至当月累计'
}

function reportStatusLabel(status: ReturnType<typeof statusByCompletion>): string {
  if (status === 'good') return '达标'
  if (status === 'watch') return '关注'
  if (status === 'risk') return '风险'
  return '缺数'
}

function warningSeverityLabel(severity: BusinessReportWarning['severity']): string {
  if (severity === 'red') return '红色预警'
  if (severity === 'yellow') return '黄色预警'
  return '提示'
}

function getReportTypeFields(
  value: EnrichedBizDataNode['metrics'][MetricCategory] | undefined,
  reportType: ReportType,
  lowerIsBetter = false
): {
  target: number | null
  completionRate: number | null
  diff: number | null
  status: ReturnType<typeof statusByCompletion>
} {
  const target = reportType === 'fone' ? value?.budget_fone ?? null : value?.budget_tuwei ?? null
  const completionRate = reportType === 'fone' ? value?.completion_fone ?? null : value?.completion_tuwei ?? null
  const diff = reportType === 'fone' ? value?.diff_fone ?? null : value?.diff_tuwei ?? null
  return {
    target,
    completionRate,
    diff,
    status: statusByCompletion(completionRate, lowerIsBetter),
  }
}

function buildMetricComparisonWideRow(params: {
  node: EnrichedBizDataNode | null
  previousNode?: EnrichedBizDataNode | null
  metric: MetricCategory
  periodScope: PeriodScope
  labelMap: Map<MetricCategory, string>
}): MetricComparisonWideRow {
  const value = params.node?.metrics[params.metric]
  const previousValue = params.previousNode?.metrics[params.metric]
  const lowerIsBetter = LOWER_IS_BETTER_METRICS.has(params.metric)
  const schoolYearBudget = getReportTypeFields(value, 'fone', lowerIsBetter)
  const breakthroughAssessment = getReportTypeFields(value, 'tuwei', lowerIsBetter)
  const schoolYearBudgetActual = value?.actual_fone ?? value?.actual ?? null
  const breakthroughAssessmentActual = value?.actual_tuwei ?? value?.actual ?? null
  const schoolYearBudgetYoy = value?.yoy_fone ?? value?.yoy ?? null
  const breakthroughAssessmentYoy = value?.yoy_tuwei ?? value?.yoy ?? null
  const actual = params.periodScope === 'monthly'
    ? schoolYearBudgetActual ?? breakthroughAssessmentActual
    : null
  const previousActual = previousValue?.actual_fone ?? previousValue?.actual_tuwei ?? previousValue?.actual

  return {
    period_scope: params.periodScope,
    node_name: params.node?.node_name ?? '未匹配节点',
    node_kind: params.node ? getNodeKind(params.node) : undefined,
    level_1: params.node?.orgHierarchy.level_1 ?? null,
    level_2: params.node?.orgHierarchy.level_2 ?? null,
    metric: params.metric,
    metric_label: params.labelMap.get(params.metric) ?? params.metric,
    actual,
    school_year_budget_actual: schoolYearBudgetActual,
    breakthrough_assessment_actual: breakthroughAssessmentActual,
    yoy: params.periodScope === 'monthly' ? schoolYearBudgetYoy ?? breakthroughAssessmentYoy : null,
    school_year_budget_yoy: schoolYearBudgetYoy,
    breakthrough_assessment_yoy: breakthroughAssessmentYoy,
    mom: actual != null && previousActual != null ? actual - previousActual : null,
    school_year_budget_target: schoolYearBudget.target,
    school_year_budget_completion_rate: schoolYearBudget.completionRate,
    school_year_budget_diff: schoolYearBudget.diff,
    school_year_budget_status: schoolYearBudget.status,
    breakthrough_assessment_target: breakthroughAssessment.target,
    breakthrough_assessment_completion_rate: breakthroughAssessment.completionRate,
    breakthrough_assessment_diff: breakthroughAssessment.diff,
    breakthrough_assessment_status: breakthroughAssessment.status,
  }
}

function buildMetricComparisonWideTable(params: {
  monthRoot: EnrichedBizDataNode | null
  previousRoot: EnrichedBizDataNode | null
  cumulativeToMonthRoot: EnrichedBizDataNode | null
  schoolYearTargetRoot: EnrichedBizDataNode | null
  metrics: MetricCategory[]
  labelMap: Map<MetricCategory, string>
}): MetricComparisonWideRow[] {
  return [
    ...params.metrics.map(metric => buildMetricComparisonWideRow({
      node: params.monthRoot,
      previousNode: params.previousRoot,
      metric,
      periodScope: 'monthly',
      labelMap: params.labelMap,
    })),
    ...params.metrics.map(metric => buildMetricComparisonWideRow({
      node: params.cumulativeToMonthRoot,
      metric,
      periodScope: 'cumulative_to_month',
      labelMap: params.labelMap,
    })),
    ...params.metrics.map(metric => buildMetricComparisonWideRow({
      node: params.schoolYearTargetRoot,
      metric,
      periodScope: 'school_year_target',
      labelMap: params.labelMap,
    })),
  ].filter(row =>
    row.actual != null
    || row.school_year_budget_target != null
    || row.school_year_budget_completion_rate != null
    || row.breakthrough_assessment_target != null
    || row.breakthrough_assessment_completion_rate != null
  )
}

function buildCostExpenseWideTable(params: {
  costExpenseRows: CostExpenseRow[]
}): CostExpenseWideRow[] {
  const byKey = new Map<string, CostExpenseRow[]>()
  params.costExpenseRows.forEach(row => {
    const key = [
      row.period_scope,
      row.node_name,
      row.metric,
      row.node_kind,
      row.level_1 ?? '',
      row.level_2 ?? '',
    ].join('|')
    byKey.set(key, [...(byKey.get(key) ?? []), row])
  })

  return [...byKey.values()].map(rows => {
    const base = rows[0]
    const schoolYearBudget = rows.find(row => row.report_type === 'fone')
    const breakthroughAssessment = rows.find(row => row.report_type === 'tuwei')
    const schoolYearBudgetActual = schoolYearBudget?.actual ?? base.actual
    const breakthroughAssessmentActual = breakthroughAssessment?.actual ?? base.actual
    const actual = base.period_scope === 'monthly'
      ? schoolYearBudgetActual ?? breakthroughAssessmentActual
      : null
    return {
      period_scope: base.period_scope,
      node_name: base.node_name,
      node_kind: base.node_kind,
      level_1: base.level_1,
      level_2: base.level_2,
      metric: base.metric,
      metric_label: base.metric_label,
      actual,
      school_year_budget_actual: schoolYearBudgetActual,
      breakthrough_assessment_actual: breakthroughAssessmentActual,
      yoy: base.period_scope === 'monthly' ? schoolYearBudget?.yoy ?? breakthroughAssessment?.yoy ?? base.yoy : null,
      school_year_budget_yoy: schoolYearBudget?.yoy ?? base.yoy,
      breakthrough_assessment_yoy: breakthroughAssessment?.yoy ?? base.yoy,
      mom: base.mom,
      school_year_budget_target: schoolYearBudget?.target ?? null,
      school_year_budget_completion_rate: schoolYearBudget?.completion_rate ?? null,
      school_year_budget_diff: schoolYearBudget?.diff ?? null,
      school_year_budget_status: schoolYearBudget?.status ?? 'missing',
      breakthrough_assessment_target: breakthroughAssessment?.target ?? null,
      breakthrough_assessment_completion_rate: breakthroughAssessment?.completion_rate ?? null,
      breakthrough_assessment_diff: breakthroughAssessment?.diff ?? null,
      breakthrough_assessment_status: breakthroughAssessment?.status ?? 'missing',
    }
  })
}

function buildSchoolYearGoalAssessmentTable(params: {
  schoolYearTargetRoot: EnrichedBizDataNode | null
  month: string
  labelMap: Map<MetricCategory, string>
}): SchoolYearGoalAssessmentRow[] {
  const progressRate = schoolYearProgressRate(params.month)
  return CORE_TARGET_METRICS.map(metric => {
    const value = params.schoolYearTargetRoot?.metrics[metric]
    const schoolYearBudgetActual = value?.actual_fone ?? value?.actual ?? null
    const breakthroughAssessmentActual = value?.actual_tuwei ?? value?.actual ?? null
    const actual = null
    const schoolYearBudget = getReportTypeFields(value, 'fone')
    const breakthroughAssessment = getReportTypeFields(value, 'tuwei')
    const schoolYearBudgetAssessment = assessGoalProbability({
      completionRate: schoolYearBudget.completionRate,
      progressRate,
      actual: schoolYearBudgetActual,
      metric,
    })
    const breakthroughAssessmentResult = assessGoalProbability({
      completionRate: breakthroughAssessment.completionRate,
      progressRate,
      actual: breakthroughAssessmentActual,
      metric,
    })
    const metricLabel = params.labelMap.get(metric) ?? FALLBACK_METRIC_LABELS[metric]

    return {
      period_scope: 'school_year_target',
      node_name: params.schoolYearTargetRoot?.node_name ?? '未匹配节点',
      metric,
      metric_label: metricLabel,
      actual,
      school_year_budget_actual: schoolYearBudgetActual,
      breakthrough_assessment_actual: breakthroughAssessmentActual,
      school_year_progress_rate: progressRate,
      school_year_budget_target: schoolYearBudget.target,
      school_year_budget_completion_rate: schoolYearBudget.completionRate,
      school_year_budget_diff: schoolYearBudget.diff,
      school_year_budget_progress_gap: schoolYearBudgetAssessment.progressGap,
      school_year_budget_probability: schoolYearBudgetAssessment.probability,
      school_year_budget_risk: schoolYearBudgetAssessment.risk,
      breakthrough_assessment_target: breakthroughAssessment.target,
      breakthrough_assessment_completion_rate: breakthroughAssessment.completionRate,
      breakthrough_assessment_diff: breakthroughAssessment.diff,
      breakthrough_assessment_progress_gap: breakthroughAssessmentResult.progressGap,
      breakthrough_assessment_probability: breakthroughAssessmentResult.probability,
      breakthrough_assessment_risk: breakthroughAssessmentResult.risk,
      judgement: `${metricLabel}学年目标进度为${formatBriefPct(progressRate)}，学年预算达成概率${schoolYearBudgetAssessment.probability}、风险${schoolYearBudgetAssessment.risk}；突围考核达成概率${breakthroughAssessmentResult.probability}、风险${breakthroughAssessmentResult.risk}。`,
    }
  })
}

function buildTargetVsActualRow(
  node: EnrichedBizDataNode | null,
  reportType: ReportType,
  periodScope: PeriodScope
): TargetVsActualRow {
  const revenue = node?.metrics.revenue
  const profit = node?.metrics.pretax_profit
  const revenueActual = reportType === 'fone'
    ? revenue?.actual_fone ?? revenue?.actual ?? null
    : revenue?.actual_tuwei ?? revenue?.actual ?? null
  const profitActual = reportType === 'fone'
    ? profit?.actual_fone ?? profit?.actual ?? null
    : profit?.actual_tuwei ?? profit?.actual ?? null
  return {
    report_type: reportType,
    period_scope: periodScope,
    node_name: node?.node_name ?? '未匹配节点',
    revenue_actual: revenueActual,
    revenue_target: reportType === 'fone' ? revenue?.budget_fone ?? null : revenue?.budget_tuwei ?? null,
    revenue_completion_rate: reportType === 'fone' ? revenue?.completion_fone ?? null : revenue?.completion_tuwei ?? null,
    revenue_diff: reportType === 'fone' ? revenue?.diff_fone ?? null : revenue?.diff_tuwei ?? null,
    pretax_profit_actual: profitActual,
    pretax_profit_target: reportType === 'fone' ? profit?.budget_fone ?? null : profit?.budget_tuwei ?? null,
    pretax_profit_completion_rate: reportType === 'fone' ? profit?.completion_fone ?? null : profit?.completion_tuwei ?? null,
    pretax_profit_diff: reportType === 'fone' ? profit?.diff_fone ?? null : profit?.diff_tuwei ?? null,
  }
}

function buildSummaryCards(params: {
  monthRoot: EnrichedBizDataNode | null
  previousRoot: EnrichedBizDataNode | null
  cumulativeToMonthRoot: EnrichedBizDataNode | null
  schoolYearTargetRoot: EnrichedBizDataNode | null
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

      const cumulativeMetric = metricValue(params.cumulativeToMonthRoot, metric, reportType, params.labelMap)
      rows.push({
        ...cumulativeMetric,
        report_type: reportType,
        period_scope: 'cumulative_to_month',
        status: statusByCompletion(cumulativeMetric.completion_rate, LOWER_IS_BETTER_METRICS.has(metric)),
      })

      const schoolYearMetric = metricValue(params.schoolYearTargetRoot, metric, reportType, params.labelMap)
      rows.push({
        ...schoolYearMetric,
        report_type: reportType,
        period_scope: 'school_year_target',
        status: statusByCompletion(schoolYearMetric.completion_rate, LOWER_IS_BETTER_METRICS.has(metric)),
      })
    }
  }
  return rows
}

function buildTargetVsActualTable(
  monthRoot: EnrichedBizDataNode | null,
  cumulativeToMonthRoot: EnrichedBizDataNode | null,
  schoolYearTargetRoot: EnrichedBizDataNode | null,
  reportTypes: ReportType[]
) {
  return reportTypes.flatMap(reportType => [
    buildTargetVsActualRow(monthRoot, reportType, 'monthly'),
    buildTargetVsActualRow(cumulativeToMonthRoot, reportType, 'cumulative_to_month'),
    buildTargetVsActualRow(schoolYearTargetRoot, reportType, 'school_year_target'),
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
      revenue_actual: reportType === 'fone'
        ? revenue?.actual_fone ?? revenue?.actual ?? null
        : revenue?.actual_tuwei ?? revenue?.actual ?? null,
      revenue_share: contributionShare(revenue?.actual ?? null, totalRevenue),
      revenue_completion_rate: revenueCompletion,
      pretax_profit_actual: reportType === 'fone'
        ? profit?.actual_fone ?? profit?.actual ?? null
        : profit?.actual_tuwei ?? profit?.actual ?? null,
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
    revenue_actual: reportType === 'fone'
      ? revenue?.actual_fone ?? revenue?.actual ?? null
      : revenue?.actual_tuwei ?? revenue?.actual ?? null,
    revenue_share: contributionShare(revenue?.actual ?? null, totalRevenue),
    revenue_completion_rate: revenueCompletion,
    pretax_profit_actual: reportType === 'fone'
      ? profit?.actual_fone ?? profit?.actual ?? null
      : profit?.actual_tuwei ?? profit?.actual ?? null,
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

  for (const periodScope of ['monthly', 'cumulative_to_month', 'school_year_target'] as const) {
    for (const reportType of ['fone', 'tuwei'] as const) {
      const row = targetRows.find(item => item.period_scope === periodScope && item.report_type === reportType)
      const effectiveRequiredFields = periodScope === 'school_year_target'
        ? requiredTargetFields.filter(field => field.startsWith('revenue_') || field.startsWith('pretax_profit_'))
        : requiredTargetFields
      const availableFields = row ? getAvailableFields(row) : []
      const missingFields = effectiveRequiredFields.filter(field => !availableFields.includes(field))
      matrix.push({
        section: '目标对标总表',
        period_scope: periodScope,
        report_type: reportType,
        required_fields: effectiveRequiredFields,
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

function buildWritingBrief(params: {
  scopeProfile: BusinessReportPack['scope_profile']
  summaryCards: BusinessReportPack['summary_cards']
  targetVsActualTable: BusinessReportPack['target_vs_actual_table']
  schoolYearGoalAssessmentTable: BusinessReportPack['school_year_goal_assessment_table']
  directChildrenTable: BusinessReportPack['direct_children_table']
  unitCards: BusinessReportPack['unit_cards']
  costExpenseSummary: BusinessReportPack['cost_expense_summary']
  varianceRankings: BusinessReportPack['variance_rankings']
  warnings: BusinessReportPack['warnings']
}): BusinessReportWritingBrief {
  const schoolYearGoalPoints = params.schoolYearGoalAssessmentTable.map(row =>
    `${row.metric_label}学年目标：实际${formatBriefNumber(row.actual)}万元，学年预算完成率${formatBriefPct(row.school_year_budget_completion_rate)}、达成概率${row.school_year_budget_probability}、风险${row.school_year_budget_risk}；突围考核完成率${formatBriefPct(row.breakthrough_assessment_completion_rate)}、达成概率${row.breakthrough_assessment_probability}、风险${row.breakthrough_assessment_risk}。`
  )

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
        `${reportTypeLabel(row.report_type)}${periodScopeLabel(row.period_scope)}${row.metric_label}完成率${formatBriefPct(row.completion_rate)}，差额${formatBriefNumber(row.diff)}万元，状态${reportStatusLabel(row.status)}。`
      ),
    ...params.varianceRankings.expense_over_budget_top.slice(0, 5).map(row =>
      `${row.node_name}${row.metric_label || '费用'}超预算${formatBriefNumber(row.diff)}万元，完成率${formatBriefPct(row.completion_rate)}。`
    ),
  ]

  const riskActionPoints = params.warnings
    .filter(warning => warning.section !== '专项数据覆盖')
    .slice(0, 10)
    .map(warning => `${warningSeverityLabel(warning.severity)}：${warning.node_name ? `${warning.node_name}，` : ''}${warning.message}`)

  return {
    focus: params.scopeProfile.recommended_report_focus,
    school_year_goal_points: schoolYearGoalPoints,
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
        section: card.period_scope === 'monthly' ? '当月核心指标' : `${periodScopeLabel(card.period_scope)}核心指标`,
        message: `${reportTypeLabel(card.report_type)}${card.metric_label}${periodScopeLabel(card.period_scope)}完成状态为${reportStatusLabel(card.status)}。`,
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
        section: row.period_scope === 'monthly' ? '当月成本费用' : `${periodScopeLabel(row.period_scope)}成本费用`,
        node_name: row.node_name,
        message: `${reportTypeLabel(row.report_type)}${row.node_name}${periodScopeLabel(row.period_scope)}${row.metric_label}完成状态为${reportStatusLabel(row.status)}。`,
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
  cumulativeToMonthReports: EduBizReport[]
  schoolYearTargetReports: EduBizReport[]
}): BusinessReportPack['coverage'] {
  const hasMonthly = params.monthReports.length > 0
  const hasPrevious = params.previousReports.length > 0
  const hasCumulativeToMonth = params.cumulativeToMonthReports.length > 0
  const hasSchoolYearTarget = params.schoolYearTargetReports.length > 0
  const availableCount = [hasMonthly, hasPrevious, hasCumulativeToMonth, hasSchoolYearTarget].filter(Boolean).length
  return {
    core_biz_data: availableCount === 4 ? 'available' : availableCount > 0 ? 'partial' : 'missing',
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
        '生成完整月度经营分析报告所需的数据包。一次性返回学年预算与突围考核、当月/上月/截至当月累计/学年目标累计、宽表、全量指标明细、提问组织下至少两层组织数据、组织构成、差异排行、风险预警和人工补充章节占位。适用于经营分析报告、月报、汇报材料。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称。传空字符串表示集团整体/整棵树。若已通过 resolve_org_nodes 得到 org_scope_key，应同时传 org_scope_key。',
          },
          org_scope_key: {
            type: 'string',
            description: '可选。组织稳定路径键，用于精确定位同名组织，优先级高于 node_name。',
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
            description: '可选。兼容旧参数，表示截至当月累计期间；不传时按 month 自动推导，如 202603 -> <202604。',
          },
          school_year_target_period: {
            type: 'string',
            description: '可选。学年目标累计期间；不传时按教育学年自动推导，如 202603 -> <202607。',
          },
          report_types: {
            type: 'array',
            description: '报表口径，默认同时返回学年预算与突围考核。内部枚举：fone=学年预算，tuwei=突围考核。',
            items: { type: 'string', enum: ['fone', 'tuwei'] },
          },
          max_units: {
            type: 'number',
            description: '最多返回多少个 unit_cards，默认 60。',
          },
        },
        required: ['month'],
      } as ToolDefinition['function']['parameters'],
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const validated = validateArgs(args)
    if (!validated.ok) return JSON.stringify({ error: validated.message }, null, 2)

    const nodeName = validated.values.node_name ?? ''
    const orgScopeKey = validated.values.org_scope_key
    const month = validated.values.month
    const previousMonth = validated.values.previous_month || inferPreviousMonth(month)
    const cumulativeToMonthPeriod = validated.values.cumulative_period || inferCumulativeToMonthPeriod(month)
    const schoolYearTargetPeriod = validated.values.school_year_target_period || inferSchoolYearTargetPeriod(month)
    const reportTypes: ReportType[] = validated.values.report_types?.length ? validated.values.report_types : ['fone', 'tuwei']
    const maxUnits = validated.values.max_units ?? 60

    const [monthReports, previousReports, cumulativeToMonthReports, schoolYearTargetReports] = await Promise.all([
      fetchBizReport({ period: month, periodType: 'monthly', reportTypes }),
      fetchBizReport({ period: previousMonth, periodType: 'monthly', reportTypes }),
      fetchBizReport({ period: cumulativeToMonthPeriod, periodType: 'cumulative', reportTypes }),
      fetchBizReport({ period: schoolYearTargetPeriod, periodType: 'cumulative', reportTypes }),
    ])

    const labelMap = buildMetricLabelMap([...monthReports, ...previousReports, ...cumulativeToMonthReports, ...schoolYearTargetReports])
    const monthNodes = aggregateReportNodes(monthReports)
    const previousNodes = aggregateReportNodes(previousReports)
    const cumulativeToMonthNodes = aggregateReportNodes(cumulativeToMonthReports)
    const schoolYearTargetNodes = aggregateReportNodes(schoolYearTargetReports)

    const cumulativeToMonthResolved = resolveRootNode(cumulativeToMonthNodes, nodeName, orgScopeKey)
    if (!cumulativeToMonthResolved.ok) {
      return JSON.stringify({
        message: cumulativeToMonthResolved.message,
        query_echo: {
          node_name: nodeName,
          org_scope_key: orgScopeKey ?? null,
          month,
          previous_month: previousMonth,
          cumulative_to_month_period: cumulativeToMonthPeriod,
          school_year_target_period: schoolYearTargetPeriod,
          report_types: reportTypes,
        },
        candidates: cumulativeToMonthResolved.candidates,
      }, null, 2)
    }

    const resolvedNodeName = cumulativeToMonthResolved.root?.node_name ?? nodeName
    const resolvedOrgScopeKey = cumulativeToMonthResolved.root ? buildOrgScopeKey(cumulativeToMonthResolved.root) : orgScopeKey
    const monthResolved = resolveRootNode(monthNodes, resolvedNodeName, resolvedOrgScopeKey)
    const previousResolved = resolveRootNode(previousNodes, resolvedNodeName, resolvedOrgScopeKey)
    const schoolYearTargetResolved = resolveRootNode(schoolYearTargetNodes, resolvedNodeName, resolvedOrgScopeKey)
    const monthRoot = monthResolved.ok ? monthResolved.root : null
    const previousRoot = previousResolved.ok ? previousResolved.root : null
    const cumulativeToMonthRoot = cumulativeToMonthResolved.root
    const schoolYearTargetRoot = schoolYearTargetResolved.ok ? schoolYearTargetResolved.root : null

    if (!monthRoot && !cumulativeToMonthRoot && !schoolYearTargetRoot) {
      return JSON.stringify({
        message: '未找到可用于生成报告的经营数据',
        query_echo: {
          node_name: nodeName,
          org_scope_key: orgScopeKey ?? null,
          month,
          previous_month: previousMonth,
          cumulative_to_month_period: cumulativeToMonthPeriod,
          school_year_target_period: schoolYearTargetPeriod,
          report_types: reportTypes,
        },
      }, null, 2)
    }

    const preferredReportType: ReportType = reportTypes.includes('tuwei') ? 'tuwei' : reportTypes[0]
    const summaryCards = buildSummaryCards({ monthRoot, previousRoot, cumulativeToMonthRoot, schoolYearTargetRoot, reportTypes, labelMap })
    const targetVsActualTable = buildTargetVsActualTable(monthRoot, cumulativeToMonthRoot, schoolYearTargetRoot, reportTypes)
    const metricComparisonWideTable = buildMetricComparisonWideTable({
      monthRoot,
      previousRoot,
      cumulativeToMonthRoot,
      schoolYearTargetRoot,
      metrics: SUMMARY_METRICS,
      labelMap,
    })
    const schoolYearGoalAssessmentTable = buildSchoolYearGoalAssessmentTable({
      schoolYearTargetRoot,
      month,
      labelMap,
    })
    const directChildrenTable = buildCompositionRows(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType)
    const organizationTwoLevelTable = buildOrganizationTwoLevelTable(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes)
    const keyDescendantTable = buildKeyDescendantRows(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType)
    const leafExceptionTable = buildLeafExceptionRows(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType)
    const costExpenseSummary = [
      ...buildCostExpenseRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: cumulativeToMonthRoot,
        allNodes: cumulativeToMonthResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative_to_month',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: schoolYearTargetRoot,
        allNodes: schoolYearTargetResolved.ok ? schoolYearTargetResolved.allNodes : [],
        reportTypes,
        periodScope: 'school_year_target',
        labelMap,
      }),
    ].filter(row => row.node_name === (cumulativeToMonthRoot?.node_name ?? schoolYearTargetRoot?.node_name ?? monthRoot?.node_name))
    const costExpenseTable = [
      ...buildCostExpenseRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: cumulativeToMonthRoot,
        allNodes: cumulativeToMonthResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative_to_month',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: schoolYearTargetRoot,
        allNodes: schoolYearTargetResolved.ok ? schoolYearTargetResolved.allNodes : [],
        reportTypes,
        periodScope: 'school_year_target',
        labelMap,
      }),
    ]
    const costExpenseWideTable = buildCostExpenseWideTable({ costExpenseRows: costExpenseTable })
    const allMetricTable = [
      ...buildAllMetricRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildAllMetricRows({
        root: cumulativeToMonthRoot,
        allNodes: cumulativeToMonthResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative_to_month',
        labelMap,
      }),
      ...buildAllMetricRows({
        root: schoolYearTargetRoot,
        allNodes: schoolYearTargetResolved.ok ? schoolYearTargetResolved.allNodes : [],
        reportTypes,
        periodScope: 'school_year_target',
        labelMap,
      }),
    ]
    const unitCards = buildUnitCards({
      monthRoot,
      previousRoot,
      cumulativeRoot: cumulativeToMonthRoot,
      monthNodes: monthResolved.ok ? monthResolved.allNodes : [],
      cumulativeNodes: cumulativeToMonthResolved.allNodes,
      reportType: preferredReportType,
      maxUnits,
    })
    const coverage = buildCoverage({
      monthReports,
      previousReports,
      cumulativeToMonthReports,
      schoolYearTargetReports,
    })
    const metricCoverage = buildMetricCoverage([...monthReports, ...previousReports, ...cumulativeToMonthReports, ...schoolYearTargetReports])
    const dataCompletenessMatrix = buildDataCompletenessMatrix({
      targetVsActualTable,
      compositionTable: directChildrenTable,
      unitCards,
      costExpenseTable,
      coverage,
      metricCoverage,
    })
    const warnings = buildWarnings({ unitCards, summaryCards, costExpenseRows: costExpenseTable })
    const scopeProfile = buildScopeProfile(cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot, cumulativeToMonthResolved.allNodes)
    const varianceRankings = buildRankings(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType, labelMap)
    const writingBrief = buildWritingBrief({
      scopeProfile,
      summaryCards,
      targetVsActualTable,
      schoolYearGoalAssessmentTable,
      directChildrenTable,
      unitCards,
      costExpenseSummary,
      varianceRankings,
      warnings,
    })
    const basePackForQuality: BusinessReportPack = {
      metadata: {
        scope_name: cumulativeToMonthRoot?.node_name ?? schoolYearTargetRoot?.node_name ?? monthRoot?.node_name ?? (nodeName || '智汇后勤集团'),
        org_scope_key: (cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot) ? buildOrgScopeKey((cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot)!) : resolvedOrgScopeKey ?? null,
        org_path: (cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot) ? buildOrgPath((cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot)!) : [],
        month,
        previous_month: previousMonth,
        cumulative_period: cumulativeToMonthPeriod,
        cumulative_to_month_period: cumulativeToMonthPeriod,
        school_year_target_period: schoolYearTargetPeriod,
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
      metric_comparison_wide_table: metricComparisonWideTable,
      school_year_goal_assessment_table: schoolYearGoalAssessmentTable,
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
      cost_expense_wide_table: costExpenseWideTable,
      data_completeness_matrix: dataCompletenessMatrix,
      metric_coverage: metricCoverage,
      missing_data_notes: buildMissingDataNotes(coverage),
      variance_rankings: varianceRankings,
      manual_fill_sections: buildManualFillSections(),
      warnings,
    }
    const evidenceLedger = buildBusinessReportEvidenceLedger(basePackForQuality)
    const qualityContract = buildBusinessReportQualityContract(basePackForQuality)
    const sectionBriefs = buildBusinessReportSectionBriefs(basePackForQuality, evidenceLedger)
    const packQuality = validateBusinessReportPack(basePackForQuality)

    const pack: BusinessReportPack = {
      ...basePackForQuality,
      evidence_ledger: evidenceLedger,
      section_briefs: sectionBriefs,
      quality_contract: qualityContract,
      claim_rules: buildBusinessReportClaimRules(),
      render_hints: buildBusinessReportRenderHints(),
      warnings: [
        ...warnings,
        ...packQuality.findings.map(finding => ({
          severity: finding.severity === 'error' ? 'red' as const : finding.severity === 'warning' ? 'yellow' as const : 'info' as const,
          section: '报告生成质量契约',
          message: finding.message,
          evidence: {
            code: finding.code,
            quality_score: packQuality.score,
            ...finding.evidence,
          },
        })),
      ],
    }

    return JSON.stringify(pack, null, 2)
  },
}
