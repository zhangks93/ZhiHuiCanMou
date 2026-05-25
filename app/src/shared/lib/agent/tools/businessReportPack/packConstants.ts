import { DEFAULT_REPORT_METRICS } from '../reportCalculations'
import type { MetricCategory } from '@/features/biz-data/types'

export const REPORT_TYPE_VALUES = new Set(['fone', 'tuwei'])

export const SUMMARY_METRICS: MetricCategory[] = ['revenue', 'gross_profit', 'pretax_profit', 'labor_cost']

export const COST_EXPENSE_METRICS: MetricCategory[] = [
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

export const COST_EXPENSE_DETAIL_METRICS = COST_EXPENSE_METRICS.filter(metric => metric !== 'labor_cost_rate')

export const ALL_REPORT_METRICS = DEFAULT_REPORT_METRICS

export const CORE_TARGET_METRICS: Array<'revenue' | 'pretax_profit'> = ['revenue', 'pretax_profit']

export const SUPPORT_UNIT_NAME_HINTS = [
  '战略支持',
  '科创',
  '管理',
  '办公室',
  '行政',
  '人力',
  '财务',
  '支持',
  '职能',
  '综合',
  '党群',
  '法务',
  '审计',
]

export const FALLBACK_METRIC_LABELS: Record<MetricCategory, string> = {
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
