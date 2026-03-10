import type { MetricCategory } from './supabase'

export const METRIC_LABELS: Record<MetricCategory, string> = {
  revenue: '营业收入',
  catering_expense: '餐饮支出',
  material_cost: '物资销售成本',
  gross_profit: '毛利额',
  gross_margin: '毛利率',
  labor_cost: '人力成本',
  other_expense: '其他支出',
  external_revenue: '营业外收入',
  external_expense: '营业外支出',
  pretax_profit: '税前利润',
  pretax_margin: '税前利润率',
  headcount: '职工人数',
  per_capita_revenue: '人均营收',
  labor_cost_rate: '人力成本率',
  revenue_creation: '一元创收',
  profit_creation: '一元创利',
}

export const ALL_METRICS: MetricCategory[] = [
  'revenue',
  'pretax_profit',
  'gross_profit',
  'gross_margin',
  'labor_cost',
  'labor_cost_rate',
  'headcount',
  'per_capita_revenue',
  'revenue_creation',
  'profit_creation',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_revenue',
  'external_expense',
  'pretax_margin',
]

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]
