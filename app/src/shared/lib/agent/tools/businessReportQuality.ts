import type {
  BusinessReportClaimRules,
  BusinessReportEvidenceItem,
  BusinessReportPack,
  BusinessReportQualityContract,
  BusinessReportRenderHints,
  BusinessReportSectionBrief,
  BusinessReportWarning,
  MetricComparisonWideRow,
  SchoolYearGoalAssessmentRow,
} from './reportPackTypes'

export type ReportQualitySeverity = 'error' | 'warning' | 'info'

export interface ReportQualityFinding {
  severity: ReportQualitySeverity
  code: string
  message: string
  evidence?: Record<string, unknown>
}

export interface ReportQualityResult {
  passed: boolean
  score: number
  findings: ReportQualityFinding[]
  summary: string
}

const REQUIRED_SECTIONS = [
  '经营摘要与学年目标判断',
  '目标对标与实际完成',
  '组织结构、贡献与拖累',
  '成本费用与效率',
  '风险判断与后续动作',
]

const REQUIRED_TABLES = [
  'school_year_goal_assessment_table',
  'metric_comparison_wide_table',
  'organization_two_level_table',
  'cost_expense_wide_table',
]

const FORBIDDEN_TERMS = [
  'fone',
  'tuwei',
  'watch',
  'good',
  'risk',
  'missing',
  'edu_biz_report',
  'edu_biz_monthly_plan',
  'edu_org_hierarchy',
  'metric_comparison_wide_table',
  'school_year_goal_assessment_table',
  'organization_two_level_table',
  'direct_children_table',
  'key_descendant_table',
  'leaf_exception_table',
  'cost_expense_wide_table',
  'target_vs_actual_table',
  'writing_brief',
  'quality_contract',
  'evidence_ledger',
  'data_completeness_matrix',
  'coverage',
  '【待补】',
  '【人工补充】',
]
const MANUAL_DATA_SECTIONS = ['应收账款回款情况', '资金计划执行情况', '核心费用专项明细']
const PERIOD_SCOPE_LABELS = ['当月', '截至当月累计', '学年目标累计']

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '缺失'
}

function formatPct(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '缺失'
}

function periodScopeLabel(value: string | undefined): string {
  if (value === 'monthly') return '当月'
  if (value === 'cumulative_to_month') return '截至当月累计'
  if (value === 'school_year_target') return '学年目标累计'
  if (value === 'manual') return '人工补充'
  if (value === 'cross_period') return '跨期间'
  return '未标明期间'
}

function reportStatusLabel(value: string | undefined): string {
  if (value === 'good') return '达标'
  if (value === 'watch') return '关注'
  if (value === 'risk') return '风险'
  return '缺数'
}

function pushMetricEvidence(
  ledger: BusinessReportEvidenceItem[],
  row: MetricComparisonWideRow,
  index: number
) {
  ledger.push({
    id: `metric-wide-${index + 1}`,
    source: 'metric_comparison_wide_table',
    section: '目标对标与实际完成',
    claim_type: 'fact',
    confidence: 'confirmed',
    node_name: row.node_name,
    metric: row.metric,
    metric_label: row.metric_label,
    period_scope: row.period_scope,
    report_type: 'both',
    actual: row.actual ?? row.school_year_budget_actual ?? row.breakthrough_assessment_actual,
    evidence_text:
      row.period_scope === 'monthly'
        ? `${row.node_name}${periodScopeLabel(row.period_scope)}${row.metric_label}实际值${formatNumber(row.actual)}；` +
          `学年预算完成率${formatPct(row.school_year_budget_completion_rate)}、差额${formatNumber(row.school_year_budget_diff)}；` +
          `突围考核完成率${formatPct(row.breakthrough_assessment_completion_rate)}、差额${formatNumber(row.breakthrough_assessment_diff)}。`
        : `${row.node_name}${periodScopeLabel(row.period_scope)}${row.metric_label}学年预算实际值${formatNumber(row.school_year_budget_actual)}、完成率${formatPct(row.school_year_budget_completion_rate)}、差额${formatNumber(row.school_year_budget_diff)}；` +
          `突围考核实际值${formatNumber(row.breakthrough_assessment_actual)}、完成率${formatPct(row.breakthrough_assessment_completion_rate)}、差额${formatNumber(row.breakthrough_assessment_diff)}。`,
  })
}

function pushSchoolYearEvidence(
  ledger: BusinessReportEvidenceItem[],
  row: SchoolYearGoalAssessmentRow,
  index: number
) {
  ledger.push({
    id: `school-year-goal-${index + 1}`,
    source: 'school_year_goal_assessment_table',
    section: '经营摘要与学年目标判断',
    claim_type: 'judgement',
    confidence: 'derived',
    node_name: row.node_name,
    metric: row.metric,
    metric_label: row.metric_label,
    period_scope: row.period_scope,
    report_type: 'both',
    actual: row.actual,
    evidence_text:
      `${row.metric_label}学年进度${formatPct(row.school_year_progress_rate)}；` +
      `学年预算实际值${formatNumber(row.school_year_budget_actual ?? row.actual)}、达成概率${row.school_year_budget_probability}、风险${row.school_year_budget_risk}；` +
      `突围考核实际值${formatNumber(row.breakthrough_assessment_actual ?? row.actual)}、达成概率${row.breakthrough_assessment_probability}、风险${row.breakthrough_assessment_risk}。`,
  })
}

function pushWarningEvidence(
  ledger: BusinessReportEvidenceItem[],
  warning: BusinessReportWarning,
  index: number
) {
  ledger.push({
    id: `warning-${index + 1}`,
    source: 'warnings',
    section: warning.section,
    claim_type: warning.severity === 'info' ? 'manual_gap' : 'risk',
    confidence: warning.severity === 'info' ? 'manual_required' : 'derived',
    node_name: warning.node_name,
    period_scope: warning.section.includes('当月')
      ? 'monthly'
      : warning.section.includes('累计')
        ? 'cumulative_to_month'
        : 'cross_period',
    report_type: 'both',
    evidence_text: warning.message,
  })
}

export function buildBusinessReportEvidenceLedger(pack: BusinessReportPack): BusinessReportEvidenceItem[] {
  const ledger: BusinessReportEvidenceItem[] = []

  pack.metric_comparison_wide_table.slice(0, 24).forEach((row, index) => {
    pushMetricEvidence(ledger, row, index)
  })

  pack.school_year_goal_assessment_table.forEach((row, index) => {
    pushSchoolYearEvidence(ledger, row, index)
  })

  pack.cost_expense_wide_table.slice(0, 24).forEach((row, index) => {
    ledger.push({
      id: `cost-expense-${index + 1}`,
      source: 'cost_expense_wide_table',
      section: '成本费用与效率',
      claim_type: 'fact',
      confidence: 'confirmed',
      node_name: row.node_name,
      metric: row.metric,
      metric_label: row.metric_label,
      period_scope: row.period_scope,
      report_type: 'both',
      actual: row.actual,
      evidence_text:
        row.period_scope === 'monthly'
          ? `${row.node_name}${periodScopeLabel(row.period_scope)}${row.metric_label}实际值${formatNumber(row.actual)}；` +
            `学年预算状态${reportStatusLabel(row.school_year_budget_status)}，突围考核状态${reportStatusLabel(row.breakthrough_assessment_status)}。`
          : `${row.node_name}${periodScopeLabel(row.period_scope)}${row.metric_label}学年预算实际值${formatNumber(row.school_year_budget_actual)}、状态${reportStatusLabel(row.school_year_budget_status)}；` +
            `突围考核实际值${formatNumber(row.breakthrough_assessment_actual)}、状态${reportStatusLabel(row.breakthrough_assessment_status)}。`,
    })
  })

  pack.organization_two_level_table.slice(0, 24).forEach((row, index) => {
    ledger.push({
      id: `org-two-level-${index + 1}`,
      source: 'organization_two_level_table',
      section: '组织结构、贡献与拖累',
      claim_type: 'fact',
      confidence: 'confirmed',
      node_name: row.node_name,
      period_scope: 'cumulative_to_month',
      report_type: 'both',
      actual: row.revenue_actual,
      evidence_text:
        `${row.node_name}层级${row.depth_from_scope}，收入${formatNumber(row.revenue_actual)}，` +
        `税前利润${formatNumber(row.pretax_profit_actual)}，人力成本${formatNumber(row.labor_cost_actual)}。`,
    })
  })

  pack.warnings.forEach((warning, index) => {
    pushWarningEvidence(ledger, warning, index)
  })

  pack.missing_data_notes?.forEach((note, index) => {
    ledger.push({
      id: `manual-gap-${index + 1}`,
      source: 'warnings',
      section: '数据限制与待补说明',
      claim_type: 'manual_gap',
      confidence: 'manual_required',
      period_scope: 'manual',
      report_type: 'not_applicable',
      evidence_text: `${note.section}需补充：${note.fields.join('、')}；原因：${note.reason}`,
    })
  })

  return ledger
}

export function buildBusinessReportQualityContract(pack: BusinessReportPack): BusinessReportQualityContract {
  return {
    required_sections: [
      ...REQUIRED_SECTIONS,
      ...(pack.missing_data_notes?.length ? ['数据限制与待补说明'] : []),
    ],
    required_tables: REQUIRED_TABLES,
    forbidden_terms: FORBIDDEN_TERMS,
    required_chinese_report_type_labels: ['学年预算', '突围考核'],
    required_period_scope_labels: PERIOD_SCOPE_LABELS,
    manual_data_sections: MANUAL_DATA_SECTIONS,
    minimum_two_level_org_rows: pack.scope_profile.leaf_count > 0 ? 1 : 0,
    audit_tool: 'audit_business_report',
  }
}

function buildDefaultBusinessReportQualityContract(): BusinessReportQualityContract {
  return {
    required_sections: REQUIRED_SECTIONS,
    required_tables: REQUIRED_TABLES,
    forbidden_terms: FORBIDDEN_TERMS,
    required_chinese_report_type_labels: ['学年预算', '突围考核'],
    required_period_scope_labels: PERIOD_SCOPE_LABELS,
    manual_data_sections: MANUAL_DATA_SECTIONS,
    minimum_two_level_org_rows: 0,
    audit_tool: 'audit_business_report',
  }
}

export function buildBusinessReportClaimRules(): BusinessReportClaimRules {
  return {
    confidence_policy: {
      confirmed: '可直接陈述为事实，必须保留组织、期间和指标口径。',
      derived: '可作为经营判断，必须引用数据证据，不得扩写为已确认业务原因。',
      hypothesis: '只能写成原因假设或需复核事项。',
      manual_required: '只能放在数据限制或补数要求中，不得编造数值。',
    },
    period_policy: '达成率、差额、同比和管理判断必须绑定当月、截至当月累计或学年目标累计。',
    manual_data_policy: '应收账款、资金计划、核心费用专项明细当前不可自动生成，只能集中说明补数要求。',
    numeric_claim_policy: '报告中的关键数字必须来自报告包字段或 evidence_ledger，不得自行创造。',
  }
}

export function buildBusinessReportSectionBriefs(
  pack: BusinessReportPack,
  evidenceLedger: BusinessReportEvidenceItem[]
): BusinessReportSectionBrief[] {
  const idsBySection = (section: string) => evidenceLedger
    .filter(item => item.section === section)
    .slice(0, 8)
    .map(item => item.id)

  const completenessBySection = new Map(pack.data_completeness_matrix.map(row => [row.section, row.status]))

  return [
    {
      section: '经营摘要与学年目标判断',
      required: true,
      data_status: pack.school_year_goal_assessment_table.length ? 'available' : 'partial',
      primary_sources: ['writing_brief', 'school_year_goal_assessment_table'],
      required_evidence_ids: idsBySection('经营摘要与学年目标判断'),
      writing_guidance: ['先写收入和税前利润学年目标判断。', '只把学年目标表用于营业收入和税前利润。'],
    },
    {
      section: '目标对标与实际完成',
      required: true,
      data_status: completenessBySection.get('目标对标') ?? 'partial',
      primary_sources: ['metric_comparison_wide_table'],
      required_evidence_ids: idsBySection('目标对标与实际完成'),
      writing_guidance: ['实际值只展示一次，并列展示学年预算与突围考核。', '表后说明收入缺口与利润缺口是否匹配。'],
    },
    {
      section: '组织结构、贡献与拖累',
      required: true,
      data_status: pack.organization_two_level_table.length ? 'available' : 'partial',
      primary_sources: ['organization_two_level_table', 'direct_children_table', 'variance_rankings'],
      required_evidence_ids: idsBySection('组织结构、贡献与拖累'),
      writing_guidance: ['至少覆盖提问组织下属两层；若无二级下属，在数据限制中说明。', '点名贡献和拖累单位。'],
    },
    {
      section: '成本费用与效率',
      required: true,
      data_status: pack.cost_expense_wide_table.length ? 'available' : 'partial',
      primary_sources: ['cost_expense_wide_table', 'variance_rankings'],
      required_evidence_ids: idsBySection('成本费用与效率'),
      writing_guidance: ['系统已有费用指标必须正常分析。', '专项核心费用明细缺失只放结尾说明。'],
    },
    {
      section: '风险判断与后续动作',
      required: true,
      data_status: pack.warnings.length ? 'available' : 'partial',
      primary_sources: ['warnings'],
      required_evidence_ids: idsBySection('区域/中心完成情况').concat(idsBySection('专项数据覆盖')).slice(0, 8),
      writing_guidance: ['动作必须对应具体对象和证据。', '避免只写加强管理、持续关注。'],
    },
    {
      section: '数据限制与待补说明',
      required: Boolean(pack.missing_data_notes?.length),
      data_status: pack.missing_data_notes?.length ? 'manual_required' : 'available',
      primary_sources: ['warnings'],
      required_evidence_ids: idsBySection('数据限制与待补说明'),
      writing_guidance: ['只集中说明需人工补充的数据。', '不输出大面积人工补充占位表。'],
    },
  ]
}

export function buildBusinessReportRenderHints(): BusinessReportRenderHints {
  return {
    default_output: 'markdown',
    chart_json_only_when_requested: true,
    preferred_table_order: REQUIRED_TABLES,
    recommended_generation_flow: [
      'read quality_contract and section_briefs',
      'draft report from evidence_ledger and writing_brief',
      'run audit_business_report before final answer',
      'fix blocking findings before presenting final report',
    ],
  }
}

function hasAny(text: string, values: string[]): boolean {
  return values.some(value => text.includes(value))
}

function addFinding(findings: ReportQualityFinding[], finding: ReportQualityFinding) {
  findings.push(finding)
}

export function validateBusinessReportPack(pack: BusinessReportPack): ReportQualityResult {
  const findings: ReportQualityFinding[] = []

  if (pack.coverage.core_biz_data === 'missing') {
    addFinding(findings, {
      severity: 'error',
      code: 'core_data_missing',
      message: '核心经营数据缺失，不能生成完整经营分析报告。',
    })
  }

  if (!pack.writing_brief) {
    addFinding(findings, {
      severity: 'warning',
      code: 'writing_brief_missing',
      message: '报告包缺少 writing_brief，写作稳定性会下降。',
    })
  }

  if (!pack.school_year_goal_assessment_table.length) {
    addFinding(findings, {
      severity: 'error',
      code: 'school_year_goal_table_missing',
      message: '缺少学年目标达成概率与风险表。',
    })
  }

  if (!pack.metric_comparison_wide_table.length) {
    addFinding(findings, {
      severity: 'error',
      code: 'metric_comparison_wide_table_missing',
      message: '缺少目标对标宽表。',
    })
  }

  if (!pack.cost_expense_wide_table.length) {
    addFinding(findings, {
      severity: 'warning',
      code: 'cost_expense_wide_table_missing',
      message: '缺少成本费用宽表，成本费用章节只能输出有限结论。',
    })
  }

  if (pack.organization_two_level_table.length === 0) {
    addFinding(findings, {
      severity: 'warning',
      code: 'organization_two_level_table_missing',
      message: '缺少两层组织经营表，组织结构章节需要说明无法继续展开。',
    })
  } else if (
    pack.scope_profile.descendant_count > pack.scope_profile.direct_child_count &&
    !pack.organization_two_level_table.some(row => row.depth_from_scope >= 2)
  ) {
    addFinding(findings, {
      severity: 'error',
      code: 'organization_second_level_missing',
      message: '存在二级下属数据，但报告包未返回下钻第二层经营数据。',
    })
  }

  const hasErrors = findings.some(item => item.severity === 'error')
  const score = Math.max(0, 100 - findings.reduce((total, item) => total + (item.severity === 'error' ? 25 : item.severity === 'warning' ? 8 : 2), 0))

  return {
    passed: !hasErrors,
    score,
    findings,
    summary: hasErrors ? '报告包未通过生成前校验。' : '报告包通过生成前校验。',
  }
}

export function validateBusinessReportOutput(markdown: string, pack?: BusinessReportPack): ReportQualityResult {
  const text = markdown || ''
  const contract = pack?.quality_contract ?? (pack ? buildBusinessReportQualityContract(pack) : buildDefaultBusinessReportQualityContract())
  const findings: ReportQualityFinding[] = []

  for (const section of contract.required_sections) {
    if (!text.includes(section)) {
      addFinding(findings, {
        severity: section === '数据限制与待补说明' ? 'warning' : 'error',
        code: 'required_section_missing',
        message: `报告缺少必需章节：${section}`,
        evidence: { section },
      })
    }
  }

  for (const term of contract.forbidden_terms) {
    if (new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) {
      addFinding(findings, {
        severity: 'error',
        code: 'forbidden_term_present',
        message: `报告正文出现禁用词：${term}`,
        evidence: { term },
      })
    }
  }

  const markdownWithoutUrls = text.replace(/https?:\/\/\S+/g, '')
  if (/[A-Za-z]/.test(markdownWithoutUrls)) {
    addFinding(findings, {
      severity: 'error',
      code: 'latin_letters_present',
      message: '报告正文出现英文字符，终稿必须全部使用中文表达。',
    })
  }

  if (!hasAny(text, contract.required_chinese_report_type_labels)) {
    addFinding(findings, {
      severity: 'warning',
      code: 'report_type_label_missing',
      message: '报告未明确使用学年预算或突围考核中文口径。',
    })
  }

  for (const label of contract.required_period_scope_labels) {
    if (!text.includes(label)) {
      addFinding(findings, {
        severity: 'warning',
        code: 'period_scope_label_missing',
        message: `报告未出现关键期间口径：${label}`,
        evidence: { label },
      })
    }
  }

  if (pack && pack.organization_two_level_table.length > 0 && !text.includes('组织') && !text.includes('层级')) {
    addFinding(findings, {
      severity: 'warning',
      code: 'two_level_org_analysis_weak',
      message: '报告包包含两层组织数据，但正文未明显体现组织层级分析。',
    })
  }

  if (pack && pack.organization_two_level_table.some(row => row.depth_from_scope >= 2)) {
    const secondLevelRows = pack.organization_two_level_table.filter(row => row.depth_from_scope >= 2)
    const mentionedSecondLevelRows = secondLevelRows.filter(row => text.includes(row.node_name))
    if (mentionedSecondLevelRows.length === 0) {
      addFinding(findings, {
        severity: 'error',
        code: 'second_level_org_not_described',
        message: '报告包包含第二层下钻组织数据，但正文未描述任何第二层节点。',
      })
    }
  }

  const manualTermsInBody = MANUAL_DATA_SECTIONS.filter(section => text.includes(section))
  if (manualTermsInBody.length > 0 && !text.includes('数据限制与待补说明')) {
    addFinding(findings, {
      severity: 'error',
      code: 'manual_data_not_in_limitations',
      message: '人工补充数据被提及但未集中放在数据限制与待补说明中。',
      evidence: { sections: manualTermsInBody },
    })
  }

  const tableCount = (text.match(/\|---/g) ?? []).length
  if (tableCount < 3) {
    addFinding(findings, {
      severity: 'warning',
      code: 'table_count_low',
      message: '完整报告表格数量偏少，可能未充分展示目标、组织和费用数据。',
      evidence: { tableCount },
    })
  }

  const hasErrors = findings.some(item => item.severity === 'error')
  const score = Math.max(0, 100 - findings.reduce((total, item) => total + (item.severity === 'error' ? 20 : item.severity === 'warning' ? 6 : 1), 0))

  return {
    passed: !hasErrors && score >= 80,
    score,
    findings,
    summary: findings.length === 0 ? '报告通过质量审核。' : `发现 ${findings.length} 个质量问题。`,
  }
}
