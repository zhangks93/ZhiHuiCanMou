import type { MetricCategory } from '@/features/biz-data/types'

export type ReportType = 'fone' | 'tuwei'
export type PeriodScope = 'monthly' | 'cumulative' | 'cumulative_to_month' | 'school_year_target'
export type ReportStatus = 'good' | 'watch' | 'risk' | 'missing'
export type WarningSeverity = 'red' | 'yellow' | 'info'
export type GoalProbability = '已达成' | '较高' | '中等' | '较低' | '数据不足'
export type GoalRiskLevel = '低' | '中' | '高' | '需补数'

export interface ReportMetricValue {
  metric: MetricCategory
  metric_label: string
  actual: number | null
  target: number | null
  completion_rate: number | null
  diff: number | null
  yoy: number | null
  mom?: number | null
}

export interface SummaryCard extends ReportMetricValue {
  report_type: ReportType
  period_scope: PeriodScope
  status: ReportStatus
}

export interface TargetVsActualRow {
  report_type: ReportType
  period_scope: PeriodScope
  node_name: string
  revenue_actual: number | null
  revenue_target: number | null
  revenue_completion_rate: number | null
  revenue_diff: number | null
  pretax_profit_actual: number | null
  pretax_profit_target: number | null
  pretax_profit_completion_rate: number | null
  pretax_profit_diff: number | null
}

export interface MetricComparisonWideRow {
  period_scope: PeriodScope
  node_name: string
  node_kind?: string
  level_1?: string | null
  level_2?: string | null
  metric: MetricCategory
  metric_label: string
  actual: number | null
  yoy: number | null
  mom?: number | null
  school_year_budget_target: number | null
  school_year_budget_completion_rate: number | null
  school_year_budget_diff: number | null
  school_year_budget_status: ReportStatus
  breakthrough_assessment_target: number | null
  breakthrough_assessment_completion_rate: number | null
  breakthrough_assessment_diff: number | null
  breakthrough_assessment_status: ReportStatus
}

export interface SchoolYearGoalAssessmentRow {
  period_scope: 'school_year_target'
  node_name: string
  metric: 'revenue' | 'pretax_profit'
  metric_label: string
  actual: number | null
  school_year_progress_rate: number
  school_year_budget_target: number | null
  school_year_budget_completion_rate: number | null
  school_year_budget_diff: number | null
  school_year_budget_progress_gap: number | null
  school_year_budget_probability: GoalProbability
  school_year_budget_risk: GoalRiskLevel
  breakthrough_assessment_target: number | null
  breakthrough_assessment_completion_rate: number | null
  breakthrough_assessment_diff: number | null
  breakthrough_assessment_progress_gap: number | null
  breakthrough_assessment_probability: GoalProbability
  breakthrough_assessment_risk: GoalRiskLevel
  judgement: string
}

export interface CompositionRow {
  level_1: string | null
  level_2: string | null
  node_name: string
  node_kind: string
  revenue_actual: number | null
  revenue_share: number | null
  revenue_completion_rate: number | null
  pretax_profit_actual: number | null
  pretax_profit_share: number | null
  pretax_profit_completion_rate: number | null
  business_judgement: string
}

export interface UnitCard {
  node_name: string
  node_kind: string
  level_1: string | null
  level_2: string | null
  selection_reason?: string
  cumulative: TargetVsActualRow
  monthly: TargetVsActualRow
  cost_expense_metrics?: ReportMetricValue[]
  warnings: string[]
  suggested_analysis_points: string[]
}

export interface RankingRow {
  metric?: string
  metric_label?: string
  node_name: string
  node_kind?: string
  level_1?: string | null
  level_2?: string | null
  actual?: number | null
  share?: number | null
  diff?: number | null
  completion_rate?: number | null
}

export interface CostExpenseRow extends ReportMetricValue {
  report_type: ReportType
  period_scope: PeriodScope
  node_name: string
  node_kind: string
  level_1: string | null
  level_2: string | null
  status: ReportStatus
}

export interface CostExpenseWideRow extends MetricComparisonWideRow {
  node_kind: string
  level_1: string | null
  level_2: string | null
}

export interface OrganizationMetricRow extends ReportMetricValue {
  report_type: ReportType
  period_scope: PeriodScope
  node_name: string
  node_kind: string
  level_1: string | null
  level_2: string | null
  depth_from_scope: number
  within_required_two_levels: boolean
}

export interface OrganizationCoverageRow {
  node_name: string
  node_kind: string
  level_1: string | null
  level_2: string | null
  depth_from_scope: number
  child_count: number
  revenue_actual: number | null
  pretax_profit_actual: number | null
  labor_cost_actual: number | null
  gross_margin_actual: number | null
}

export interface MetricCoverage {
  expected_auto_metrics: string[]
  available_auto_metrics: string[]
  missing_auto_metrics: string[]
  note: string
}

export interface ManualFillSection {
  status: 'manual_required'
  heading: string
  reason: string
  instructions: string[]
  table_markdown: string
}

export interface ScopeProfile {
  scope_name: string
  node_kind: string
  level_1: string | null
  level_2: string | null
  direct_child_count: number
  descendant_count: number
  leaf_count: number
  recommended_report_focus: string[]
}

export interface DataCompletenessMatrixRow {
  section: string
  period_scope: PeriodScope | 'cross_period' | 'manual'
  report_type: ReportType | 'both' | 'not_applicable'
  required_fields: string[]
  status: 'available' | 'partial' | 'missing' | 'manual_required'
  missing_fields: string[]
  handling: string
}

export interface BusinessReportWarning {
  severity: WarningSeverity
  section: string
  node_name?: string
  message: string
  evidence: Record<string, unknown>
}

export interface BusinessReportWritingBrief {
  focus: string[]
  school_year_goal_points: string[]
  executive_summary_points: string[]
  target_gap_points: string[]
  structure_points: string[]
  cost_expense_points: string[]
  risk_action_points: string[]
}

export interface MissingDataNote {
  section: string
  reason: string
  fields: string[]
  handling: 'closing_note'
}

export interface BusinessReportPack {
  metadata: {
    scope_name: string
    org_scope_key?: string | null
    org_path?: string[]
    month: string
    previous_month: string
    cumulative_period: string
    cumulative_to_month_period: string
    school_year_target_period: string
    generated_at: string
    unit: '万元'
    row_counts: {
      organization_two_level_table: number
      all_metric_table: number
      cost_expense_table: number
      unit_cards: number
      warnings: number
    }
  }
  scope_profile: ScopeProfile
  writing_brief?: BusinessReportWritingBrief
  coverage: {
    core_biz_data: 'available' | 'partial' | 'missing'
    monthly_plan: 'available' | 'partial' | 'missing'
    receivables: 'manual_required'
    cash_plan: 'manual_required'
    core_expenses: 'manual_required'
    gaps: Array<{
      section: string
      field: string
      reason: string
      handling: 'manual_placeholder'
    }>
  }
  summary_cards: SummaryCard[]
  target_vs_actual_table: TargetVsActualRow[]
  metric_comparison_wide_table: MetricComparisonWideRow[]
  school_year_goal_assessment_table: SchoolYearGoalAssessmentRow[]
  composition_table: CompositionRow[]
  direct_children_table: CompositionRow[]
  organization_two_level_table: OrganizationCoverageRow[]
  all_metric_table: OrganizationMetricRow[]
  key_descendant_table: CompositionRow[]
  leaf_exception_table: CompositionRow[]
  unit_cards: UnitCard[]
  monthly_actual_table: TargetVsActualRow[]
  cost_expense_summary: CostExpenseRow[]
  cost_expense_table: CostExpenseRow[]
  cost_expense_wide_table: CostExpenseWideRow[]
  data_completeness_matrix: DataCompletenessMatrixRow[]
  metric_coverage: MetricCoverage
  missing_data_notes?: MissingDataNote[]
  variance_rankings: {
    revenue_gap_top: RankingRow[]
    profit_gap_top: RankingRow[]
    revenue_contribution_top: RankingRow[]
    profit_contribution_top: RankingRow[]
    labor_cost_over_budget_top: RankingRow[]
    expense_over_budget_top: RankingRow[]
    low_gross_margin_top: RankingRow[]
  }
  manual_fill_sections: {
    receivables: ManualFillSection
    cash_plan: ManualFillSection
    core_expenses: ManualFillSection
  }
  warnings: BusinessReportWarning[]
}
