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
export interface Profile {
  id: string
  feishu_open_id: string
  name: string | null
  avatar_url: string | null
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
