import type { MetricCategory } from '@/shared/lib/supabase'

export type { MetricCategory }

export interface EduBizReport {
  id: string
  sheet_code: '1.1' | '1.2' | '2.1' | '2.2' | '2.3'
  report_type: 'fone' | 'tuwei'
  period_type: 'cumulative' | 'monthly'
  period: string
  period_yoy: string | null
  node_name: string
  sort_order: number
  metric_category: MetricCategory
  metric_category_cn: string
  actual_value: number | null
  budget_value: number | null
  completion_rate: number | null
  diff_value: number | null
  yoy_value: number | null
  created_at: string
  org_hierarchy?: {
    level_0: string | null
    level_1: string | null
    level_2: string | null
  } | null
}

export interface EduBizMonthlyPlan {
  id: string
  node_name: string
  sort_order: number
  metric_category: 'revenue' | 'pretax_profit'
  metric_category_cn: string
  month: string
  plan_value: number | null
  created_at: string
}

export interface EduStrategyBudgetPlan {
  id: string
  strategy_group: 'base_business' | 'growth_engine' | 'overall_total' | 'strategic_kpi'
  strategy_group_cn: string
  line_role: 'detail' | 'subtotal' | 'total' | 'kpi'
  business_line: string
  line_label: string
  plan_year: number
  metric_code: 'revenue' | 'profit' | 'revenue_growth_rate' | 'profit_margin' | 'cost_ratio'
  metric_name_cn: string
  value: number | null
  unit: 'amount' | 'ratio'
  value_type: 'absolute' | 'ratio'
  sort_order: number
  source_note: string | null
  created_at: string
}

export interface BizDataNode {
  node_name: string
  sort_order: number
  hierarchy: {
    center_region: string | null
    business_segment: string | null
    report_level1: string | null
    report_level2: string | null
    is_aggregated: boolean
    aggregation_level: string | null
  }
  metrics: {
    [K in MetricCategory]?: {
      actual: number | null
      budget_fone: number | null
      budget_tuwei: number | null
      completion_fone: number | null
      completion_tuwei: number | null
      diff_fone: number | null
      diff_tuwei: number | null
      yoy: number | null
      monthly_plan?: Record<string, number>
    }
  }
}

export interface EnrichedBizDataNode extends BizDataNode {
  orgHierarchy: {
    level_0: string | null
    level_1: string | null
    level_2: string | null
  }
}
