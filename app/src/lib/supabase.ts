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
