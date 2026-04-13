import { supabase } from '@/shared/lib/supabase'
import type {
  DepartmentMemberChange,
  FeishuDepartment,
  FeishuMember,
  FeishuSyncRun,
  OrgDirectoryDataSource,
} from '../types'

function normalizeDepartment(row: Record<string, unknown>): FeishuDepartment {
  return {
    id: String(row.id ?? ''),
    department_id: String(row.department_id ?? ''),
    name: String(row.name ?? ''),
    parent_id: typeof row.parent_id === 'string' ? row.parent_id : null,
    order_value: typeof row.order_value === 'number' ? row.order_value : 0,
    member_count: typeof row.member_count === 'number' ? row.member_count : 0,
    leader_user_id: typeof row.leader_user_id === 'string' ? row.leader_user_id : null,
    status: row.status && typeof row.status === 'object' ? (row.status as Record<string, unknown>) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? row.created_at ?? ''),
  }
}

function normalizeDepartmentIds(row: Record<string, unknown>): string[] {
  const departmentIds = row.department_ids
  if (Array.isArray(departmentIds)) {
    return departmentIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
  }

  const departmentId = typeof row.department_id === 'string' && row.department_id ? row.department_id : null
  const primaryDepartmentId =
    typeof row.primary_department_id === 'string' && row.primary_department_id ? row.primary_department_id : null

  if (primaryDepartmentId) return [primaryDepartmentId]
  if (departmentId) return [departmentId]

  return []
}

function normalizeMember(row: Record<string, unknown>): FeishuMember {
  return {
    id: String(row.id ?? ''),
    open_id: String(row.open_id ?? ''),
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    name: String(row.name ?? ''),
    en_name: typeof row.en_name === 'string' ? row.en_name : null,
    employee_no: typeof row.employee_no === 'string' ? row.employee_no : null,
    email: typeof row.email === 'string' ? row.email : null,
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    department_ids: normalizeDepartmentIds(row),
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
  previousSnapshotDepartments: FeishuDepartment[]
  departmentChanges: DepartmentMemberChange[]
  dataSource: OrgDirectoryDataSource
}> {
  const [departmentRes, memberRes, latestSyncRes, snapshotRunsRes, changeRes] = await Promise.all([
    supabase.from('feishu_departments').select('*'),
    supabase.from('feishu_members').select('*'),
    supabase.from('feishu_sync_runs').select('*').order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('feishu_sync_runs').select('*').eq('snapshot_taken', true).order('snapshot_at', { ascending: false }).limit(2),
    supabase.from('feishu_department_member_changes').select('*'),
  ])

  const snapshotRuns = (snapshotRunsRes.data ?? []) as FeishuSyncRun[]
  const latestSnapshotRun = snapshotRuns[0] ?? null
  const previousSnapshotRun = snapshotRuns[1] ?? null

  let departments = (departmentRes.data ?? []).map(row => normalizeDepartment(row as Record<string, unknown>))
  let members = (memberRes.data ?? []).map(row => normalizeMember(row as Record<string, unknown>))
  let previousSnapshotDepartments: FeishuDepartment[] = []
  let dataSource: OrgDirectoryDataSource = 'live'

  if (latestSnapshotRun) {
    const [snapshotDepartmentRes, snapshotMemberRes, previousSnapshotDepartmentRes] = await Promise.all([
      supabase.from('feishu_department_snapshots').select('*').eq('sync_run_id', latestSnapshotRun.id),
      supabase.from('feishu_member_snapshots').select('*').eq('sync_run_id', latestSnapshotRun.id),
      previousSnapshotRun
        ? supabase.from('feishu_department_snapshots').select('*').eq('sync_run_id', previousSnapshotRun.id)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ])

    departments = (snapshotDepartmentRes.data ?? []).map(row => normalizeDepartment(row as Record<string, unknown>))
    members = (snapshotMemberRes.data ?? []).map(row => normalizeMember(row as Record<string, unknown>))
    previousSnapshotDepartments = (previousSnapshotDepartmentRes.data ?? []).map(row =>
      normalizeDepartment(row as Record<string, unknown>),
    )
    dataSource = 'snapshot'
  }

  return {
    departments,
    members,
    latestSyncRun: (latestSyncRes.data ?? null) as FeishuSyncRun | null,
    snapshotRuns,
    previousSnapshotDepartments,
    departmentChanges: (changeRes.data ?? []) as DepartmentMemberChange[],
    dataSource,
  }
}
