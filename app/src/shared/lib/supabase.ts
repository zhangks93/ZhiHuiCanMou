import { createClient, type User } from '@supabase/supabase-js'
import { env } from '@/app/config/env'
import type { Database } from '@/shared/lib/database.types'

export const supabase = createClient<Database>(env.supabase.url, env.supabase.anonKey)

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

