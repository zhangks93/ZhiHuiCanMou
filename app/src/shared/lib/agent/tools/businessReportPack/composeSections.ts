import type { EduBizReport } from '@/features/biz-data/types'
import type {
  BusinessReportPack,
  BusinessReportWarning,
  BusinessReportWritingBrief,
  CompositionRow,
  CostExpenseRow,
  DataCompletenessMatrixRow,
  ManualFillSection,
  MetricCoverage,
  MissingDataNote,
  SummaryCard,
  TargetVsActualRow,
  UnitCard,
  BusinessRole,
} from '../reportPackTypes'
import { COST_EXPENSE_METRICS } from './packConstants'
import {
  formatBriefNumber,
  formatBriefPct,
  periodScopeLabel,
  reportStatusLabel,
  reportTypeLabel,
  warningSeverityLabel,
} from './aggregateMetrics'

export function getAvailableFields(row: TargetVsActualRow): string[] {
  return Object.entries(row)
    .filter(([key, value]) => key !== 'node_name' && key !== 'report_type' && key !== 'period_scope' && value != null)
    .map(([key]) => key)
}

export function buildDataCompletenessMatrix(params: {
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
    handling: '优先使用直接下级数据；若下级不足，使用重点下钻单位和项目异常数据补充',
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

export function buildWritingBrief(params: {
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
    `${row.metric_label}学年目标：学年预算实际${formatBriefNumber(row.school_year_budget_actual)}万元，完成率${formatBriefPct(row.school_year_budget_completion_rate)}、达成概率${row.school_year_budget_probability}、风险${row.school_year_budget_risk}；突围考核实际${formatBriefNumber(row.breakthrough_assessment_actual)}万元，完成率${formatBriefPct(row.breakthrough_assessment_completion_rate)}、达成概率${row.breakthrough_assessment_probability}、风险${row.breakthrough_assessment_risk}。`
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
    `${row.node_name}（${row.business_role || '未识别'}）收入${formatBriefNumber(row.revenue_actual)}万元，占比${formatBriefPct(row.revenue_share)}，税前利润${formatBriefNumber(row.pretax_profit_actual)}万元，占比${formatBriefPct(row.pretax_profit_share)}；${row.analysis_treatment || row.business_judgement}`
  )

  const unitRiskPoints = params.unitCards.slice(0, 8).map(card => {
    const warnings = card.warnings.length ? `风险：${card.warnings.join('；')}` : '暂无红黄风险。'
    return `${card.node_name}（${card.selection_reason || '重点单位'}，${card.business_role || '未识别'}）：累计收入完成率${formatBriefPct(card.cumulative.revenue_completion_rate)}，累计税前利润完成率${formatBriefPct(card.cumulative.pretax_profit_completion_rate)}，${card.analysis_treatment || ''}${warnings}`
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

export function buildMissingDataNotes(coverage: BusinessReportPack['coverage']): MissingDataNote[] {
  return coverage.gaps.map(gap => ({
    section: gap.section,
    reason: gap.reason,
    fields: gap.field.split('/'),
    handling: 'closing_note',
  }))
}

export function buildManualFillSections(): BusinessReportPack['manual_fill_sections'] {
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

export function buildWarnings(params: {
  unitCards: UnitCard[]
  summaryCards: SummaryCard[]
  costExpenseRows: CostExpenseRow[]
  scopeBusinessRole?: BusinessRole
}): BusinessReportWarning[] {
  const warnings: BusinessReportWarning[] = []
  params.summaryCards
    .filter(card => card.status === 'risk' || card.status === 'watch' || card.status === 'missing')
    .forEach(card => {
      const supportIncomeMetric = params.scopeBusinessRole === '职能支持型'
        && (card.metric === 'revenue' || card.metric === 'pretax_profit')
      const severity = supportIncomeMetric
        ? 'info'
        : card.status === 'risk'
          ? 'red'
          : card.status === 'watch'
            ? 'yellow'
            : 'info'
      warnings.push({
        severity,
        section: card.period_scope === 'monthly' ? '当月核心指标' : `${periodScopeLabel(card.period_scope)}核心指标`,
        message: supportIncomeMetric
          ? `${reportTypeLabel(card.report_type)}${card.metric_label}${periodScopeLabel(card.period_scope)}完成状态为${reportStatusLabel(card.status)}；当前对象识别为职能支持型单位，应优先按成本效率和费用执行判断。`
          : `${reportTypeLabel(card.report_type)}${card.metric_label}${periodScopeLabel(card.period_scope)}完成状态为${reportStatusLabel(card.status)}。`,
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

export function buildCoverage(params: {
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
