import { supabase } from '@/shared/lib/supabase'
import type { Tables } from '@/shared/lib/database.types'

export type AttendanceMonthlyRecord = Tables<'attendance_monthly_records_v2'>

const ATTENDANCE_SELECT = [
  'id',
  'year_month',
  'attendance_type',
  'employee_no',
  'employee_name',
  'member_id',
  'work_unit',
  'department_path',
  'department_full_path',
  'expected_work_amount',
  'normal_work_amount',
  'actual_work_amount',
  'approved_leave_amount',
  'absence_amount',
  'qualified_attendance_amount',
  'attendance_rate',
  'late_under_30_count',
  'late_30_to_120_count',
  'late_total_count',
  'missing_clock_count',
  'makeup_clock_count',
  'source_file_name',
  'source_sheet_name',
  'source_row_number',
  'source_file_hash',
  'raw_metrics',
  'created_at',
  'updated_at',
].join(', ')

export async function fetchAvailableAttendanceMonths(): Promise<number[]> {
  const { data, error } = await supabase
    .from('attendance_monthly_records_v2')
    .select('year_month')
    .order('year_month', { ascending: false })

  if (error) throw error

  return [...new Set((data ?? []).map((item) => item.year_month))]
}

export async function fetchAttendanceMonthlyRecords(selectedMonth: number): Promise<AttendanceMonthlyRecord[]> {
  const PAGE_SIZE = 1000
  let page = 0
  let hasMore = true
  let records: AttendanceMonthlyRecord[] = []

  while (hasMore) {
    const { data, error } = await supabase
      .from('attendance_monthly_records_v2')
      .select(ATTENDANCE_SELECT)
      .eq('year_month', selectedMonth)
      .order('attendance_type')
      .order('source_row_number')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) throw error

    const pageData = (data ?? []) as unknown as AttendanceMonthlyRecord[]
    records = records.concat(pageData)
    hasMore = pageData.length === PAGE_SIZE
    page += 1
  }

  return records
}
