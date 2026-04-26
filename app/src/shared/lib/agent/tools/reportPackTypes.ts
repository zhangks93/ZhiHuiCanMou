import type { MetricCategory } from '@/features/biz-data/types'

export type ReportType = 'fone' | 'tuwei'
export type PeriodScope = 'monthly' | 'cumulative'
export type ReportStatus = 'good' | 'watch' | 'risk' | 'missing'
export type WarningSeverity = 'red' | 'yellow' | 'info'

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
  cumulative: TargetVsActualRow
  monthly: TargetVsActualRow
  warnings: string[]
  suggested_analysis_points: string[]
}

export interface RankingRow {
  node_name: string
  node_kind?: string
  level_1?: string | null
  level_2?: string | null
  actual?: number | null
  share?: number | null
  diff?: number | null
  completion_rate?: number | null
}

export interface ManualFillSection {
  status: 'manual_required'
  heading: string
  reason: string
  instructions: string[]
  table_markdown: string
}

export interface BusinessReportWarning {
  severity: WarningSeverity
  section: string
  node_name?: string
  message: string
  evidence: Record<string, unknown>
}

export interface BusinessReportPack {
  metadata: {
    scope_name: string
    month: string
    previous_month: string
    cumulative_period: string
    generated_at: string
    unit: '万元'
  }
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
  composition_table: CompositionRow[]
  unit_cards: UnitCard[]
  monthly_actual_table: TargetVsActualRow[]
  variance_rankings: {
    revenue_gap_top: RankingRow[]
    profit_gap_top: RankingRow[]
    revenue_contribution_top: RankingRow[]
    profit_contribution_top: RankingRow[]
  }
  manual_fill_sections: {
    receivables: ManualFillSection
    cash_plan: ManualFillSection
    core_expenses: ManualFillSection
  }
  warnings: BusinessReportWarning[]
}
