import { supabase } from '@/shared/lib/supabase'
import type { DepartmentMemberChange, FeishuDepartment, FeishuMember, FeishuSyncRun } from '../types'

function normalizeMember(row: Record<string, unknown>): FeishuMember {
  const departmentId = typeof row.department_id === 'string' && row.department_id ? row.department_id : null

  return {
    id: String(row.id ?? ''),
    open_id: String(row.open_id ?? ''),
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    name: String(row.name ?? ''),
    en_name: typeof row.en_name === 'string' ? row.en_name : null,
    employee_no: typeof row.employee_no === 'string' ? row.employee_no : null,
    email: typeof row.email === 'string' ? row.email : null,
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    department_ids: departmentId ? [departmentId] : [],
    job_title: typeof row.job_title === 'string' ? row.job_title : null,
    gender: typeof row.gender === 'number' ? row.gender : 0,
    employee_type: typeof row.employee_type === 'number' ? row.employee_type : null,
    status: row.status && typeof row.status === 'object' ? (row.status as Record<string, unknown>) : null,
    join_time: typeof row.join_time === 'number' ? row.join_time : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export async function fetchOrgDirectory(): Promise<{
  departments: FeishuDepartment[]
  members: FeishuMember[]
  latestSyncRun: FeishuSyncRun | null
  snapshotRuns: FeishuSyncRun[]
  departmentChanges: DepartmentMemberChange[]
}> {
  const [departmentRes, memberRes, latestSyncRes, snapshotRunsRes, changeRes] = await Promise.all([
    supabase.from('feishu_departments').select('*'),
    supabase.from('feishu_members').select('*'),
    supabase.from('feishu_sync_runs').select('*').order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('feishu_sync_runs').select('*').eq('snapshot_taken', true).order('snapshot_at', { ascending: false }).limit(2),
    supabase.from('feishu_department_member_changes').select('*'),
  ])

  return {
    departments: (departmentRes.data ?? []) as FeishuDepartment[],
    members: (memberRes.data ?? []).map(row => normalizeMember(row as Record<string, unknown>)),
    latestSyncRun: (latestSyncRes.data ?? null) as FeishuSyncRun | null,
    snapshotRuns: (snapshotRunsRes.data ?? []) as FeishuSyncRun[],
    departmentChanges: (changeRes.data ?? []) as DepartmentMemberChange[],
  }
}
