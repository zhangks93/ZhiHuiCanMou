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
