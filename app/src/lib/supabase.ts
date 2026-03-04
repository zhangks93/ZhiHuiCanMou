import { createClient, type User } from '@supabase/supabase-js'
import { env } from '@/config/env'

export const supabase = createClient(env.supabase.url, env.supabase.anonKey)

// --- Types ---
export interface ScheduleItem {
  id: string
  title: string
  description?: string
  start_time: string
  end_time?: string
  type: 'meeting' | 'business' | 'routine' | 'urgent'
  location?: string
  created_at?: string
}

export interface OrgData {
  id: string
  name: string
  total_count: number
  details: Record<string, number>
  updated_at?: string
}

export interface BizDataItem {
  id: string
  business_unit: string
  budget_revenue: number
  actual_revenue: number
  budget_profit: number
  actual_profit: number
  updated_at?: string
}

// --- 教育后勤经营数据 (edu_logistics_biz_data) ---
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

export interface Opportunity {
  id: string
  name: string
  amount: number
  stage: string
  level: 'A' | 'B' | 'C'
  region?: string
  owner?: string
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

// --- Opportunity Ledger (商机项目台账) ---
export interface OpportunityLedger {
  id: string
  org_id: string | null
  snapshot_date: string
  item_type: 'operation' | 'expansion' | 'tracking'
  region: string | null
  project_name: string
  estimated_amount: number | null
  logistics_approved: boolean
  group_approved: boolean
  bid_date: string | null
  status: 'tracking' | 'bidding' | 'contracted' | 'operating' | 'suspended' | 'lost' | null
  remark: string | null
  win_probability: number | null
  manager_ready: boolean
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

// --- 考勤数据 ---
export interface Employee {
  id: string
  employee_code: string
  name: string
  company: string | null
  department: string | null
  join_date: string | null
  level: string | null
  employee_type: string | null
  created_at: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  period_start: string
  period_end: string
  expected_days: number | null
  actual_days: number | null
  work_days: number | null
  overtime_days: number | null
  personal_leave: number | null
  sick_leave: number | null
  bereavement_leave: number | null
  marriage_leave: number | null
  maternity_leave: number | null
  annual_leave: number | null
  compensatory_leave: number | null
  other_leave: number | null
  absent_days: number | null
  late_times: number | null
  early_leave_times: number | null
  created_at: string
  updated_at: string
}

export interface AttendanceWithEmployee extends AttendanceRecord {
  employee: Employee
}

export interface DepartmentAttendanceSummary {
  department: string
  employee_count: number
  total_expected: number
  total_actual: number
  rate: number
  total_leave: number
  total_late: number
  total_early: number
  total_absent: number
  total_overtime: number
}
