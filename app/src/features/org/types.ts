export interface FeishuDepartment {
  id: string
  department_id: string
  name: string
  parent_id: string | null
  order_value: number
  member_count: number
  leader_user_id: string | null
  status: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface FeishuMember {
  id: string
  open_id: string
  user_id: string | null
  name: string
  en_name: string | null
  employee_no: string | null
  email: string | null
  avatar_url: string | null
  department_ids: string[]
  job_title: string | null
  gender: number
  employee_type: number | null
  status: Record<string, unknown> | null
  join_time: number | null
  created_at: string
  updated_at: string
}

export interface FeishuSyncRun {
  id: string
  started_at: string
  finished_at: string
  snapshot_taken: boolean
  snapshot_at: string | null
  last_snapshot_at: string | null
  snapshot_reason: string | null
  root_department_ids: string[]
  department_count: number
  member_count: number
  created_at: string
}

export interface DepartmentMemberChange {
  department_id: string
  department_name: string
  parent_id: string | null
  order_value: number
  current_member_count: number
  previous_member_count: number
  member_count_change: number
  change_type: 'new' | 'removed' | 'changed' | 'unchanged'
  latest_snapshot_at: string | null
  previous_snapshot_at: string | null
}
