import type { MetricCategory } from './supabase'

// 指标分组定义
export interface MetricGroup {
  label: string
  metrics: MetricCategory[]
}

export const METRIC_GROUPS: MetricGroup[] = [
  {
    label: '核心',
    metrics: ['revenue', 'gross_profit', 'gross_margin', 'pretax_profit', 'pretax_margin'],
  },
  {
    label: '成本',
    metrics: ['catering_expense', 'material_cost', 'other_expense', 'external_expense'],
  },
  {
    label: '人力',
    metrics: ['labor_cost', 'salary', 'social_insurance', 'housing_fund', 'labor_service_fee', 'other_labor_cost'],
  },
  {
    label: '费用',
    metrics: ['vehicle_expense', 'energy_expense', 'travel_expense', 'entertainment_expense'],
  },
  {
    label: '其他',
    metrics: ['external_revenue','headcount', 'per_capita_revenue', 'labor_cost_rate', 'revenue_creation', 'profit_creation'],
  },
]

export const METRIC_LABELS: Record<MetricCategory, string> = {
  // 核心收入利润
  revenue: '营业收入',
  gross_profit: '毛利额',
  gross_margin: '毛利率',
  pretax_profit: '税前利润',
  pretax_margin: '税前利润率',
  // 成本支出
  catering_expense: '餐饮支出',
  material_cost: '物资销售成本',
  other_expense: '其他支出',
  external_expense: '营业外支出',
  // 人力成本明细
  labor_cost: '人力成本',
  salary: '工资',
  social_insurance: '社保',
  housing_fund: '公积金',
  labor_service_fee: '劳务费',
  other_labor_cost: '其他人力成本',
  // 其他费用
  vehicle_expense: '车辆费用',
  energy_expense: '能耗费',
  travel_expense: '差旅费',
  entertainment_expense: '业务招待费',
  // 其他收入
  external_revenue: '营业外收入',
  // 效率指标
  headcount: '职工人数',
  per_capita_revenue: '人均营收',
  labor_cost_rate: '人力成本率',
  revenue_creation: '一元创收',
  profit_creation: '一元创利',
}

export const ALL_METRICS: MetricCategory[] = [
  // 核心收入利润
  'revenue',
  'gross_profit',
  'gross_margin',
  'pretax_profit',
  'pretax_margin',
  // 成本支出
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
  // 人力成本明细
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  // 其他费用
  'vehicle_expense',
  'energy_expense',
  'travel_expense',
  'entertainment_expense',
  // 其他收入
  'external_revenue',
  // 效率指标
  'headcount',
  'per_capita_revenue',
  'labor_cost_rate',
  'revenue_creation',
  'profit_creation',
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
