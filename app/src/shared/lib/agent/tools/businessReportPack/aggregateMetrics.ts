import type { EduBizReport, EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import { getChildren, getNodeKind } from '@/features/biz-data/services/bizDataService'
import {
  contributionShare,
  DEFAULT_REPORT_METRICS,
  assessGoalProbability,
  formatPctForJudgement,
  LOWER_IS_BETTER_METRICS,
  schoolYearProgressRate,
  statusByCompletion,
} from '../reportCalculations'
import type {
  BusinessRole,
  BusinessReportWarning,
  CompositionRow,
  CostExpenseRow,
  CostExpenseWideRow,
  MetricComparisonWideRow,
  MetricCoverage,
  OrganizationCoverageRow,
  OrganizationMetricRow,
  PeriodScope,
  RankingRow,
  ReportMetricValue,
  ReportType,
  SchoolYearGoalAssessmentRow,
  ScopeProfile,
  SummaryCard,
  TargetVsActualRow,
  UnitCard,
} from '../reportPackTypes'
import {
  ALL_REPORT_METRICS,
  CORE_TARGET_METRICS,
  COST_EXPENSE_DETAIL_METRICS,
  COST_EXPENSE_METRICS,
  FALLBACK_METRIC_LABELS,
  SUMMARY_METRICS,
  SUPPORT_UNIT_NAME_HINTS,
} from './packConstants'
import {
  collectSubtreeWithDepth,
  findNodeByName,
  flattenSubtree,
} from './fetchData'

export function formatBriefNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '无数据'
  return value.toFixed(2)
}

export function formatBriefPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '无数据'
  return (value * 100).toFixed(1) + '%'
}


export function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function safeDiffValue(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null) return null
  return actual - target
}

export function safeCompletionValue(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || target === 0) return null
  return actual / target
}

export function metricActual(
  value: EnrichedBizDataNode['metrics'][MetricCategory] | undefined,
  reportType: ReportType
): number | null {
  if (reportType === 'fone') return finiteOrNull(value?.actual_fone ?? value?.actual)
  return finiteOrNull(value?.actual_tuwei ?? value?.actual)
}

export function metricTarget(
  value: EnrichedBizDataNode['metrics'][MetricCategory] | undefined,
  reportType: ReportType
): number | null {
  return finiteOrNull(reportType === 'fone' ? value?.budget_fone : value?.budget_tuwei)
}

export function metricCompletion(
  value: EnrichedBizDataNode['metrics'][MetricCategory] | undefined,
  reportType: ReportType
): number | null {
  const returned = finiteOrNull(reportType === 'fone' ? value?.completion_fone : value?.completion_tuwei)
  if (returned != null) return returned
  return safeCompletionValue(metricActual(value, reportType), metricTarget(value, reportType))
}

export function metricDiff(
  value: EnrichedBizDataNode['metrics'][MetricCategory] | undefined,
  reportType: ReportType
): number | null {
  const returned = finiteOrNull(reportType === 'fone' ? value?.diff_fone : value?.diff_tuwei)
  if (returned != null) return returned
  return safeDiffValue(metricActual(value, reportType), metricTarget(value, reportType))
}

export function metricYoy(
  value: EnrichedBizDataNode['metrics'][MetricCategory] | undefined,
  reportType: ReportType
): number | null {
  if (reportType === 'fone') return finiteOrNull(value?.yoy_fone ?? value?.yoy)
  return finiteOrNull(value?.yoy_tuwei ?? value?.yoy)
}

export function nodeActual(node: EnrichedBizDataNode | null, metric: MetricCategory, reportType: ReportType): number | null {
  return metricActual(node?.metrics[metric], reportType)
}

export function nodeCompletion(node: EnrichedBizDataNode | null, metric: MetricCategory, reportType: ReportType): number | null {
  return metricCompletion(node?.metrics[metric], reportType)
}

export function nodeDiff(node: EnrichedBizDataNode | null, metric: MetricCategory, reportType: ReportType): number | null {
  return metricDiff(node?.metrics[metric], reportType)
}

export function inferBusinessRole(node: EnrichedBizDataNode): BusinessRole {
  const text = [
    node.node_name,
    node.orgHierarchy.level_0,
    node.orgHierarchy.level_1,
    node.orgHierarchy.level_2,
  ].filter(Boolean).join(' ')
  const hasSupportName = SUPPORT_UNIT_NAME_HINTS.some(hint => text.includes(hint))
  const revenue = finiteOrNull(node.metrics.revenue?.actual)
  const laborCost = finiteOrNull(node.metrics.labor_cost?.actual)
  const hasCost = laborCost != null && Math.abs(laborCost) > 0

  if (hasSupportName && (revenue == null || Math.abs(revenue) < 0.0001) && hasCost) return '职能支持型'
  if (hasSupportName) return revenue != null && Math.abs(revenue) > 0.0001 ? '混合型' : '职能支持型'
  return revenue != null && Math.abs(revenue) > 0.0001 ? '经营型' : '未识别'
}

export function analysisTreatment(role: BusinessRole): string {
  if (role === '职能支持型') return '按成本效率、费用执行和服务支撑分析，不因无营收或利润为负直接判定经营问题。'
  if (role === '混合型') return '同时观察收入利润兑现和成本效率，避免仅按单一指标下结论。'
  if (role === '经营型') return '按收入兑现、利润转化和目标完成情况分析。'
  return '结合收入、利润、成本和部门属性审慎判断。'
}

export function isSupportUnit(node: EnrichedBizDataNode): boolean {
  return inferBusinessRole(node) === '职能支持型'
}

export function metricValue(
  node: EnrichedBizDataNode | null,
  metric: MetricCategory,
  reportType: ReportType,
  labelMap: Map<MetricCategory, string>,
  previousNode?: EnrichedBizDataNode | null
): ReportMetricValue {
  const value = node?.metrics[metric]
  const previousValue = previousNode?.metrics[metric]
  const target = metricTarget(value, reportType)
  const completionRate = metricCompletion(value, reportType)
  const diff = metricDiff(value, reportType)
  const actual = metricActual(value, reportType)
  const previousActual = metricActual(previousValue, reportType)
  const yoy = metricYoy(value, reportType)

  return {
    metric,
    metric_label: labelMap.get(metric) ?? metric,
    actual,
    actual_fone: metricActual(value, 'fone'),
    actual_tuwei: metricActual(value, 'tuwei'),
    target,
    completion_rate: completionRate,
    diff,
    yoy,
    yoy_fone: metricYoy(value, 'fone'),
    yoy_tuwei: metricYoy(value, 'tuwei'),
    mom: actual != null && previousActual != null ? actual - previousActual : null,
  }
}

export function reportTypeLabel(reportType: ReportType): string {
  return reportType === 'fone' ? '学年预算' : '突围考核'
}

export function periodScopeLabel(scope: PeriodScope): string {
  if (scope === 'monthly') return '当月'
  if (scope === 'school_year_target') return '学年目标累计'
  return '截至当月累计'
}

export function reportStatusLabel(status: ReturnType<typeof statusByCompletion>): string {
  if (status === 'good') return '达标'
  if (status === 'watch') return '关注'
  if (status === 'risk') return '风险'
  return '缺数'
}

export function warningSeverityLabel(severity: BusinessReportWarning['severity']): string {
  if (severity === 'red') return '红色预警'
  if (severity === 'yellow') return '黄色预警'
  return '提示'
}

export function getReportTypeFields(
  value: EnrichedBizDataNode['metrics'][MetricCategory] | undefined,
  reportType: ReportType,
  lowerIsBetter = false
): {
  target: number | null
  completionRate: number | null
  diff: number | null
  status: ReturnType<typeof statusByCompletion>
} {
  const target = metricTarget(value, reportType)
  const completionRate = metricCompletion(value, reportType)
  const diff = metricDiff(value, reportType)
  return {
    target,
    completionRate,
    diff,
    status: statusByCompletion(completionRate, lowerIsBetter),
  }
}

export function buildMetricComparisonWideRow(params: {
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
  const schoolYearBudgetActual = metricActual(value, 'fone')
  const breakthroughAssessmentActual = metricActual(value, 'tuwei')
  const schoolYearBudgetYoy = metricYoy(value, 'fone')
  const breakthroughAssessmentYoy = metricYoy(value, 'tuwei')
  const actual = params.periodScope === 'monthly'
    ? schoolYearBudgetActual ?? breakthroughAssessmentActual
    : null
  const previousActual = metricActual(previousValue, 'fone') ?? metricActual(previousValue, 'tuwei')

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

export function buildMetricComparisonWideTable(params: {
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
    || row.school_year_budget_actual != null
    || row.breakthrough_assessment_actual != null
    || row.school_year_budget_target != null
    || row.school_year_budget_completion_rate != null
    || row.school_year_budget_diff != null
    || row.breakthrough_assessment_target != null
    || row.breakthrough_assessment_completion_rate != null
    || row.breakthrough_assessment_diff != null
  )
}

export function buildCostExpenseWideTable(params: {
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

export function buildSchoolYearGoalAssessmentTable(params: {
  schoolYearTargetRoot: EnrichedBizDataNode | null
  month: string
  labelMap: Map<MetricCategory, string>
}): SchoolYearGoalAssessmentRow[] {
  const progressRate = schoolYearProgressRate(params.month)
  return CORE_TARGET_METRICS.map(metric => {
    const value = params.schoolYearTargetRoot?.metrics[metric]
    const schoolYearBudgetActual = metricActual(value, 'fone')
    const breakthroughAssessmentActual = metricActual(value, 'tuwei')
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

export function buildTargetVsActualRow(
  node: EnrichedBizDataNode | null,
  reportType: ReportType,
  periodScope: PeriodScope
): TargetVsActualRow {
  const revenue = node?.metrics.revenue
  const profit = node?.metrics.pretax_profit
  const revenueActual = metricActual(revenue, reportType)
  const profitActual = metricActual(profit, reportType)
  return {
    report_type: reportType,
    period_scope: periodScope,
    node_name: node?.node_name ?? '未匹配节点',
    revenue_actual: revenueActual,
    revenue_target: metricTarget(revenue, reportType),
    revenue_completion_rate: metricCompletion(revenue, reportType),
    revenue_diff: metricDiff(revenue, reportType),
    pretax_profit_actual: profitActual,
    pretax_profit_target: metricTarget(profit, reportType),
    pretax_profit_completion_rate: metricCompletion(profit, reportType),
    pretax_profit_diff: metricDiff(profit, reportType),
  }
}

export function buildSummaryCards(params: {
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

export function buildTargetVsActualTable(
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

export function buildCompositionRows(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], reportType: ReportType): CompositionRow[] {
  if (!root) return []
  const children = getChildren(root, allNodes)
  const totalRevenue = nodeActual(root, 'revenue', reportType)
  const totalProfit = nodeActual(root, 'pretax_profit', reportType)

  return children.map(child => {
    const revenue = child.metrics.revenue
    const profit = child.metrics.pretax_profit
    const role = inferBusinessRole(child)
    const revenueCompletion = metricCompletion(revenue, reportType)
    const profitCompletion = metricCompletion(profit, reportType)

    return {
      level_1: child.orgHierarchy.level_1,
      level_2: child.orgHierarchy.level_2,
      node_name: child.node_name,
      node_kind: getNodeKind(child),
      business_role: role,
      analysis_treatment: analysisTreatment(role),
      risk_basis: role === '职能支持型' ? '重点看人力成本、费用执行率和成本刚性。' : '重点看收入兑现、利润转化和目标缺口。',
      revenue_actual: metricActual(revenue, reportType),
      revenue_share: contributionShare(metricActual(revenue, reportType), totalRevenue),
      revenue_completion_rate: revenueCompletion,
      pretax_profit_actual: metricActual(profit, reportType),
      pretax_profit_share: contributionShare(metricActual(profit, reportType), totalProfit),
      pretax_profit_completion_rate: profitCompletion,
      business_judgement: role === '职能支持型'
        ? `职能支持型单位，${analysisTreatment(role)}人力成本${formatBriefNumber(metricActual(child.metrics.labor_cost, reportType))}万元。`
        : `收入完成率${formatPctForJudgement(revenueCompletion)}，税前利润完成率${formatPctForJudgement(profitCompletion)}。`,
    }
  })
}

export function buildCompositionRow(
  node: EnrichedBizDataNode,
  root: EnrichedBizDataNode | null,
  reportType: ReportType,
  label?: string
): CompositionRow {
  const revenue = node.metrics.revenue
  const profit = node.metrics.pretax_profit
  const totalRevenue = nodeActual(root, 'revenue', reportType)
  const totalProfit = nodeActual(root, 'pretax_profit', reportType)
  const role = inferBusinessRole(node)
  const revenueCompletion = metricCompletion(revenue, reportType)
  const profitCompletion = metricCompletion(profit, reportType)

  return {
    level_1: node.orgHierarchy.level_1,
    level_2: node.orgHierarchy.level_2,
    node_name: node.node_name,
    node_kind: getNodeKind(node),
    business_role: role,
    analysis_treatment: analysisTreatment(role),
    risk_basis: role === '职能支持型' ? '重点看人力成本、费用执行率和成本刚性。' : '重点看收入兑现、利润转化和目标缺口。',
    revenue_actual: metricActual(revenue, reportType),
    revenue_share: contributionShare(metricActual(revenue, reportType), totalRevenue),
    revenue_completion_rate: revenueCompletion,
    pretax_profit_actual: metricActual(profit, reportType),
    pretax_profit_share: contributionShare(metricActual(profit, reportType), totalProfit),
    pretax_profit_completion_rate: profitCompletion,
    business_judgement: role === '职能支持型'
      ? `${label ? `${label}：` : ''}职能支持型单位，${analysisTreatment(role)}人力成本${formatBriefNumber(metricActual(node.metrics.labor_cost, reportType))}万元。`
      : `${label ? `${label}：` : ''}收入完成率${formatPctForJudgement(revenueCompletion)}，税前利润完成率${formatPctForJudgement(profitCompletion)}。`,
  }
}

export function buildKeyDescendantRows(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], reportType: ReportType): CompositionRow[] {
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

export function buildLeafExceptionRows(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[], reportType: ReportType): CompositionRow[] {
  if (!root) return []
  return flattenSubtree(root, allNodes)
    .filter(node => {
      if (node.node_name === root.node_name) return false
      if (getNodeKind(node) !== 'leaf' && getNodeKind(node) !== 'orphan') return false
      const supportUnit = isSupportUnit(node)
      const profitCompletion = nodeCompletion(node, 'pretax_profit', reportType)
      const revenueCompletion = nodeCompletion(node, 'revenue', reportType)
      const profitActual = nodeActual(node, 'pretax_profit', reportType)
      const expenseOverrun = COST_EXPENSE_DETAIL_METRICS.some(metric => (nodeDiff(node, metric, reportType) ?? 0) > 0)
      if (supportUnit) return expenseOverrun
      return (profitCompletion != null && profitCompletion < 0.8)
        || (revenueCompletion != null && revenueCompletion < 0.8)
        || (profitActual ?? 0) < 0
    })
    .sort((a, b) => {
      const left = nodeCompletion(a, 'pretax_profit', reportType)
      const right = nodeCompletion(b, 'pretax_profit', reportType)
      return (left ?? Number.POSITIVE_INFINITY) - (right ?? Number.POSITIVE_INFINITY)
    })
    .map(node => buildCompositionRow(node, root, reportType, '项目异常'))
}

export function buildOrganizationTwoLevelTable(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[]): OrganizationCoverageRow[] {
  return collectSubtreeWithDepth(root, allNodes).map(({ node, depth }) => {
    const role = inferBusinessRole(node)
    return {
      node_name: node.node_name,
      node_kind: getNodeKind(node),
      level_1: node.orgHierarchy.level_1,
      level_2: node.orgHierarchy.level_2,
      business_role: role,
      analysis_treatment: analysisTreatment(role),
      risk_basis: role === '职能支持型' ? '重点看人力成本、费用执行率和成本刚性。' : '重点看收入兑现、利润转化和目标缺口。',
      depth_from_scope: depth,
      child_count: getChildren(node, allNodes).length,
      revenue_actual: node.metrics.revenue?.actual ?? null,
      pretax_profit_actual: node.metrics.pretax_profit?.actual ?? null,
      labor_cost_actual: node.metrics.labor_cost?.actual ?? null,
      gross_margin_actual: node.metrics.gross_margin?.actual ?? null,
    }
  })
}

export function buildAllMetricRows(params: {
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
        business_role: inferBusinessRole(node),
        analysis_treatment: analysisTreatment(inferBusinessRole(node)),
        depth_from_scope: depth,
        within_required_two_levels: depth <= 2,
      }))
    )
  )
}

export function buildUnitCards(params: {
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
      const role = inferBusinessRole(node)
      const supportUnit = role === '职能支持型'
      const revenueCompletion = metricCompletion(revenue, params.reportType)
      const profitCompletion = metricCompletion(profit, params.reportType)
      const revenueDiff = metricDiff(revenue, params.reportType)
      const profitDiff = metricDiff(profit, params.reportType)
      const expenseOverrun = COST_EXPENSE_DETAIL_METRICS.reduce((sum, metric) => {
        const diffValue = nodeDiff(node, metric, params.reportType)
        return sum + Math.max(0, diffValue ?? 0)
      }, 0)
      const riskScore = [
        !supportUnit && profitCompletion != null && profitCompletion < 0.8 ? 40 : 0,
        !supportUnit && revenueCompletion != null && revenueCompletion < 0.8 ? 25 : 0,
        !supportUnit && (nodeActual(node, 'pretax_profit', params.reportType) ?? 0) < 0 ? 35 : 0,
        expenseOverrun > 0 ? supportUnit ? 30 : 15 : 0,
      ].reduce((sum, value) => sum + value, 0)
      const contributionScore = Math.abs(nodeActual(node, 'revenue', params.reportType) ?? 0)
        + Math.abs(nodeActual(node, 'pretax_profit', params.reportType) ?? 0)
        + Math.abs(nodeActual(node, 'labor_cost', params.reportType) ?? 0)
      const gapScore = supportUnit
        ? expenseOverrun
        : Math.abs(Math.min(0, revenueDiff ?? 0)) + Math.abs(Math.min(0, profitDiff ?? 0))
      const depthScore = collectSubtreeWithDepth(params.cumulativeRoot, params.cumulativeNodes)
        .find(item => item.node.node_name === node.node_name)?.depth ?? 0
      const selectionScore = riskScore * 1_000_000 + gapScore * 1_000 + contributionScore + depthScore * 10
      const selectionReason = riskScore > 0
        ? supportUnit ? '成本风险优先' : '风险优先'
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
      const role = inferBusinessRole(node)
      const supportUnit = role === '职能支持型'
      const warnings: string[] = []
      if (!supportUnit && (cumulativeRow.revenue_completion_rate ?? 1) < 0.8) warnings.push('累计收入完成率低于80%，需关注收入兑现节奏。')
      if (!supportUnit && (cumulativeRow.pretax_profit_completion_rate ?? 1) < 0.8) warnings.push('累计税前利润完成率低于80%，需关注利润转化和成本刚性。')
      if (!supportUnit && (monthlyRow.pretax_profit_actual ?? 0) < 0) warnings.push('当月税前利润为负，需复核项目毛利和费用确认。')
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
        business_role: role,
        analysis_treatment: analysisTreatment(role),
        risk_basis: supportUnit ? '重点看人力成本、费用执行率和成本刚性。' : '重点看收入兑现、利润转化和目标缺口。',
        selection_reason: selectionReason,
        cumulative: cumulativeRow,
        monthly: monthlyRow,
        cost_expense_metrics: cumulativeCostMetrics,
        warnings,
        suggested_analysis_points: supportUnit
          ? [
              '按职能支持型单位处理，重点复核人力成本、费用执行率和成本刚性。',
              '不因无营收或利润为负直接归为经营问题；如费用超预算，再形成成本效率风险判断。',
            ]
          : [
              '对照收入完成率与税前利润完成率，判断规模兑现和利润转化是否匹配。',
              '结合成本费用明细，区分人力刚性、餐饮/物资成本和重点费用超支压力。',
            ],
      }
    })
}

export function buildScopeProfile(root: EnrichedBizDataNode | null, allNodes: EnrichedBizDataNode[]): ScopeProfile {
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
        ? ['明细单位完成情况', '低毛利和费用超支项目', '当月对累计目标影响']
        : ['本单位目标达成', '当月/累计趋势', '费用和人工补充事项']

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
export function rankingRow(
  node: EnrichedBizDataNode,
  metric: MetricCategory,
  reportType: ReportType,
  totalActual: number | null,
  labelMap?: Map<MetricCategory, string>
): RankingRow {
  const value = node.metrics[metric]
  const role = inferBusinessRole(node)
  return {
    metric,
    metric_label: labelMap?.get(metric) ?? FALLBACK_METRIC_LABELS[metric],
    node_name: node.node_name,
    node_kind: getNodeKind(node),
    level_1: node.orgHierarchy.level_1,
    level_2: node.orgHierarchy.level_2,
    business_role: role,
    analysis_treatment: analysisTreatment(role),
    actual: metricActual(value, reportType),
    share: contributionShare(metricActual(value, reportType), totalActual),
    diff: metricDiff(value, reportType),
    completion_rate: metricCompletion(value, reportType),
  }
}

export function buildRankings(
  root: EnrichedBizDataNode | null,
  allNodes: EnrichedBizDataNode[],
  reportType: ReportType,
  labelMap: Map<MetricCategory, string>
) {
  const nodes = flattenSubtree(root, allNodes).filter(node => node.node_name !== root?.node_name)
  const revenueTotal = nodeActual(root, 'revenue', reportType)
  const profitTotal = nodeActual(root, 'pretax_profit', reportType)
  const revenueRows = nodes.map(node => rankingRow(node, 'revenue', reportType, revenueTotal, labelMap))
  const profitRows = nodes.map(node => rankingRow(node, 'pretax_profit', reportType, profitTotal, labelMap))
  const laborCostRows = nodes.map(node => rankingRow(node, 'labor_cost', reportType, nodeActual(root, 'labor_cost', reportType), labelMap))
  const expenseRows = nodes.flatMap(node =>
    COST_EXPENSE_DETAIL_METRICS
      .filter(metric => metric !== 'labor_cost')
      .map(metric => rankingRow(node, metric, reportType, nodeActual(root, metric, reportType), labelMap))
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
export function buildCostExpenseRows(params: {
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
          business_role: inferBusinessRole(node),
          analysis_treatment: analysisTreatment(inferBusinessRole(node)),
          status: statusByCompletion(value.completion_rate, LOWER_IS_BETTER_METRICS.has(metric)),
        })
      }
    }
  }

  return rows
}

export function buildMetricCoverage(reports: EduBizReport[]): MetricCoverage {
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
