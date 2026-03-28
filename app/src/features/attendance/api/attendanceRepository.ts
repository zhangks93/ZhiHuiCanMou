import { supabase } from '@/lib/supabase'

export async function fetchAvailableAttendanceMonths() {
  const { data } = await supabase
    .from('attendance_records')
    .select('year_month')
    .order('year_month', { ascending: false })

  return [...new Set(data?.map((item) => item.year_month) || [])]
}

export async function fetchAttendanceSummaryRecords(selectedMonth: number) {
  return Promise.all([
    supabase
      .from('attendance_records')
      .select(`
        *,
        feishu_members:member_id (
          name,
          employee_no,
          job_title
        ),
        feishu_departments:department_id (
          department_id,
          name,
          parent_id
        )
      `)
      .eq('year_month', selectedMonth),
    supabase
      .from('feishu_departments')
      .select('department_id, name, parent_id'),
  ])
}

export async function fetchDepartmentMemberRecords(selectedMonth: number, deptId: string) {
  return supabase
    .from('attendance_records')
    .select(`
      id,
      expected_days,
      actual_days,
      leave_days,
      absent_days,
      late_times,
      early_leave_times,
      feishu_members:member_id (
        name,
        employee_no,
        job_title
      )
    `)
    .eq('year_month', selectedMonth)
    .eq('department_id', deptId)
}
