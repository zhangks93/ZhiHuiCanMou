import { createClient, type User } from '@supabase/supabase-js'
import { env } from '@/config/env'

export const supabase = createClient(env.supabase.url, env.supabase.anonKey)

// --- 教育后勤经营数据 (NEW: edu_biz_report & edu_biz_monthly_plan) ---

// 指标类别枚举 (25个指标)
export type MetricCategory =
  // 核心收入利润指标
  | 'revenue'              // 营业收入
  | 'gross_profit'         // 毛利额
  | 'gross_margin'         // 毛利率
  | 'pretax_profit'        // 税前利润
  | 'pretax_margin'        // 税前利润率
  // 成本支出指标
  | 'catering_expense'     // 餐饮支出
  | 'material_cost'        // 物资销售成本
  | 'other_expense'        // 其他支出
  | 'external_expense'     // 营业外支出
  // 人力成本明细
  | 'labor_cost'           // 人力成本
  | 'salary'               // 工资
  | 'social_insurance'     // 社保
  | 'housing_fund'         // 公积金
  | 'labor_service_fee'    // 劳务费
  | 'other_labor_cost'     // 其他人力成本
  // 其他费用
  | 'vehicle_expense'      // 车辆费用
  | 'energy_expense'       // 能耗费
  | 'travel_expense'       // 差旅费
  | 'entertainment_expense' // 业务招待费
  // 其他收入
  | 'external_revenue'     // 营业外收入
  // 效率指标
  | 'headcount'            // 职工人数
  | 'per_capita_revenue'   // 人均营收
  | 'labor_cost_rate'      // 人力成本率
  | 'revenue_creation'     // 一元创收
  | 'profit_creation'      // 一元创利

// edu_biz_report 表结构
export interface EduBizReport {
  id: string
  sheet_code: '1.1' | '1.2' | '2.1' | '2.2' | '2.3'
  report_type: 'fone' | 'tuwei'  // fone=年初预算, tuwei=突围考核
  period_type: 'cumulative' | 'monthly'
  period: string  // e.g., "<202603" (cumulative), "202602" (monthly)
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
  // JOIN with edu_org_hierarchy (manually enriched)
  org_hierarchy?: {
    level_0: string | null
    level_1: string | null
    level_2: string | null
  } | null
}

// edu_biz_monthly_plan 表结构
export interface EduBizMonthlyPlan {
  id: string
  node_name: string
  sort_order: number
  metric_category: 'revenue' | 'pretax_profit'
  metric_category_cn: string
  month: string  // '202601'-'202606' or 'total'
  plan_value: number | null
  created_at: string
}

// 聚合后的业务数据节点（用于UI展示）
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
      budget_fone: number | null      // 年初预算
      budget_tuwei: number | null     // 突围考核数
      completion_fone: number | null
      completion_tuwei: number | null
      diff_fone: number | null
      diff_tuwei: number | null
      yoy: number | null
      monthly_plan?: Record<string, number>  // For revenue & pretax_profit
    }
  }
}

// 增强的业务数据节点（包含 edu_org_hierarchy 层级信息）
export interface EnrichedBizDataNode extends BizDataNode {
  orgHierarchy: {
    level_0: string | null
    level_1: string | null
    level_2: string | null
  }
}

// --- 教育后勤经营数据 (DEPRECATED: edu_logistics_biz_data) ---
// @deprecated Use EduBizReport and EduBizMonthlyPlan instead
// 层级由 center/biz_class/org_tag 列推导：
//   level 0: center IS NULL（合计）
//   level 1: center 有值, biz_class 为空（中心）
//   level 2: node_name === biz_class（板块分类）
//   level 3: org_tag 有值（业务单位）
// 百分比/比率字段以小数存储（0.7563 = 75.63%）
export interface BizDataSnapshot {
  id: string
  node_name: string
  center: string | null
  biz_class: string | null
  biz_level1: string | null
  org_tag: string | null
  node_level?: number
  parent_name?: string | null
  // Revenue 营收
  actual_revenue: number | null
  budget_revenue: number | null
  revenue_completion_rate: number | null
  revenue_diff: number | null
  yoy_revenue: number | null
  // Material 物资
  actual_material: number | null
  budget_material: number | null
  material_completion_rate: number | null
  yoy_material: number | null
  // Meal 餐费
  actual_meal: number | null
  budget_meal: number | null
  meal_completion_rate: number | null
  yoy_meal: number | null
  // Gross Profit 毛利
  actual_gross_profit: number | null
  budget_gross_profit: number | null
  gross_profit_completion_rate: number | null
  yoy_gross_profit: number | null
  // Gross Margin 毛利率
  actual_gross_margin: number | null
  budget_gross_margin: number | null
  gross_margin_diff: number | null
  yoy_gross_margin: number | null
  // Labor Cost 人力成本
  actual_labor_cost: number | null
  budget_labor_cost: number | null
  labor_cost_completion_rate: number | null
  yoy_labor_cost: number | null
  // Other Cost 其他成本
  actual_other_cost: number | null
  budget_other_cost: number | null
  other_cost_completion_rate: number | null
  yoy_other_cost: number | null
  // External Revenue/Expense 外收/外支
  actual_external_revenue: number | null
  budget_external_revenue: number | null
  yoy_external_revenue: number | null
  actual_external_expense: number | null
  budget_external_expense: number | null
  yoy_external_expense: number | null
  // Profit 利润
  actual_profit: number | null
  budget_profit: number | null
  profit_completion_rate: number | null
  profit_diff: number | null
  yoy_profit: number | null
  // Profit Margin 利润率
  actual_profit_margin: number | null
  budget_profit_margin: number | null
  profit_margin_diff: number | null
  yoy_profit_margin: number | null
  // Labor Cost Rate 人力成本率
  actual_labor_cost_rate: number | null
  budget_labor_cost_rate: number | null
  labor_cost_rate_completion: number | null
  yoy_labor_cost_rate: number | null
  // Revenue/Profit Creation 创收/创利
  actual_revenue_creation: number | null
  budget_revenue_creation: number | null
  revenue_creation_completion_rate: number | null
  yoy_revenue_creation: number | null
  actual_profit_creation: number | null
  budget_profit_creation: number | null
  profit_creation_completion_rate: number | null
  yoy_profit_creation: number | null
  // Headcount 人数
  actual_headcount: number | null
  budget_headcount: number | null
  headcount_diff: number | null
  yoy_headcount: number | null
  // Per Capita Labor 人均人力
  actual_per_capita_labor: number | null
  yoy_per_capita_labor: number | null
  budget_per_capita_labor: number | null
  per_capita_labor_diff: number | null
  // Meta
  dashboard_flag: string | null
  created_at: string
}

// --- Profile (public.profiles - synced from Feishu) ---
export type UserRole = 'president' | 'director' | 'manager' | 'supervisor'

export interface Profile {
  id: string
  feishu_open_id: string
  name: string | null
  avatar_url: string | null
  org_id: string | null
  org_node_id: string | null
  reports_to_id: string | null
  role: UserRole | null
  updated_at: string
}

// --- Org & Modules ---
export interface Organization {
  id: string
  name: string
}

export interface OrgNode {
  id: string
  org_id: string
  parent_id: string | null
  name: string
  path: string | null
}

export interface OrgSettings {
  id: string
  org_id: string
  enabled_module_ids: string[]
}

export interface Module {
  id: string
  name: string
  section: string
  route_path: string
  sort_order: number
  reporter_view_enabled: boolean
  manager_view_enabled: boolean
}

// --- Work Items (Phase 2) ---
export interface WorkItemLink {
  url: string
  title?: string
}

export interface WorkItem {
  id: string
  org_id: string
  module_id: string
  reporter_id: string
  title: string | null
  content: string | null
  links: WorkItemLink[]
  status: 'todo' | 'in_progress' | 'in_review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  period_start: string | null
  period_end: string | null
  created_at: string
  updated_at: string
}

// --- User metadata from Feishu OAuth ---
export interface UserMetadata {
  name?: string
  avatar?: string
  [key: string]: unknown
}

export function getUserDisplayInfo(user: User): { name: string; avatarUrl?: string } {
  const meta = (user.user_metadata ?? {}) as UserMetadata
  return {
    name: meta?.name ?? user.email ?? '未命名用户',
    avatarUrl: meta?.avatar,
  }
}

