import { supabase, type FeishuDepartment, type FeishuMember } from '@/lib/supabase'

export async function fetchOrgDirectory(): Promise<{
  departments: FeishuDepartment[]
  members: FeishuMember[]
}> {
  const [departmentRes, memberRes] = await Promise.all([
    supabase.from('feishu_departments').select('*'),
    supabase.from('feishu_members').select('*'),
  ])

  return {
    departments: (departmentRes.data ?? []) as FeishuDepartment[],
    members: (memberRes.data ?? []) as FeishuMember[],
  }
}
