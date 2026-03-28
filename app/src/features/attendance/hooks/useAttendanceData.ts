import { useEffect, useMemo, useState } from 'react'
import {
  fetchAvailableAttendanceMonths,
  fetchAttendanceSummaryRecords,
  fetchDepartmentMemberRecords,
} from '../api/attendanceRepository'

export interface DeptSummary {
  department_id: string
  department_name: string
  parent_name: string | null
  employee_count: number
  total_expected: number
  total_actual: number
  total_leave: number
  total_absent: number
  total_late: number
  total_early: number
  rate: number
}

export interface MemberRecord {
  id: string
  member_name: string
  employee_no: string
  job_title: string | null
  expected_days: number
  actual_days: number
  leave_days: number
  absent_days: number
  late_times: number
  early_leave_times: number
  rate: number
}

export function useAttendanceData() {
  const [summaries, setSummaries] = useState<DeptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(202601)
  const [availableMonths, setAvailableMonths] = useState<number[]>([])
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [memberRecords, setMemberRecords] = useState<MemberRecord[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  useEffect(() => {
    async function loadMonths() {
      const months = await fetchAvailableAttendanceMonths()
      setAvailableMonths(months)
      if (months.length > 0) setSelectedMonth(months[0])
    }

    void loadMonths()
  }, [])

  useEffect(() => {
    if (!selectedMonth) return

    async function loadSummary() {
      setLoading(true)

      const [recordsRes, departmentsRes] = await fetchAttendanceSummaryRecords(selectedMonth)
      if (recordsRes.error) {
        console.error('获取考勤数据失败:', recordsRes.error)
        setLoading(false)
        return
      }

      const deptMap = new Map<string, { name: string; parent_id: string | null }>()
      departmentsRes.data?.forEach((dept) => {
        deptMap.set(dept.department_id, { name: dept.name, parent_id: dept.parent_id })
      })

      const summaryMap = new Map<string, DeptSummary>()

      recordsRes.data?.forEach((record: Record<string, unknown>) => {
        const dept = record.feishu_departments as { department_id: string; name: string; parent_id: string | null } | null
        if (!dept) return

        const parentInfo = dept.parent_id ? deptMap.get(dept.parent_id) : null
        if (!summaryMap.has(dept.department_id)) {
          summaryMap.set(dept.department_id, {
            department_id: dept.department_id,
            department_name: dept.name,
            parent_name: parentInfo?.name || null,
            employee_count: 0,
            total_expected: 0,
            total_actual: 0,
            total_leave: 0,
            total_absent: 0,
            total_late: 0,
            total_early: 0,
            rate: 0,
          })
        }

        const summary = summaryMap.get(dept.department_id)!
        summary.employee_count += 1
        summary.total_expected += Number(record.expected_days) || 0
        summary.total_actual += Number(record.actual_days) || 0
        summary.total_leave += Number(record.leave_days) || 0
        summary.total_absent += Number(record.absent_days) || 0
        summary.total_late += Number(record.late_times) || 0
        summary.total_early += Number(record.early_leave_times) || 0
      })

      const result = Array.from(summaryMap.values()).map((summary) => ({
        ...summary,
        rate: summary.total_expected > 0 ? (summary.total_actual / summary.total_expected) * 100 : 0,
      })).sort((a, b) => b.rate - a.rate)

      setSummaries(result)
      setLoading(false)
    }

    void loadSummary()
  }, [selectedMonth])

  const fetchMembers = async (deptId: string) => {
    setLoadingMembers(true)
    const { data, error } = await fetchDepartmentMemberRecords(selectedMonth, deptId)

    if (error) {
      console.error('获取成员记录失败:', error)
      setLoadingMembers(false)
      return
    }

    const records: MemberRecord[] = data?.map((record: Record<string, unknown>) => {
      const member = record.feishu_members as { name?: string; employee_no?: string; job_title?: string } | null
      return {
        id: record.id as string,
        member_name: member?.name || '未知',
        employee_no: member?.employee_no || '-',
        job_title: member?.job_title || null,
        expected_days: Number(record.expected_days) || 0,
        actual_days: Number(record.actual_days) || 0,
        leave_days: Number(record.leave_days) || 0,
        absent_days: Number(record.absent_days) || 0,
        late_times: Number(record.late_times) || 0,
        early_leave_times: Number(record.early_leave_times) || 0,
        rate: Number(record.expected_days) > 0 ? (Number(record.actual_days) / Number(record.expected_days)) * 100 : 0,
      }
    }) || []

    setMemberRecords(records)
    setLoadingMembers(false)
  }

  const toggleDepartment = async (deptId: string) => {
    if (expandedDept === deptId) {
      setExpandedDept(null)
      setMemberRecords([])
      return
    }
    setExpandedDept(deptId)
    await fetchMembers(deptId)
  }

  const overallStats = useMemo(() => ({
    employeeCount: summaries.reduce((sum, summary) => sum + summary.employee_count, 0),
    expectedDays: summaries.reduce((sum, summary) => sum + summary.total_expected, 0),
    actualDays: summaries.reduce((sum, summary) => sum + summary.total_actual, 0),
    totalLeave: summaries.reduce((sum, summary) => sum + summary.total_leave, 0),
    totalLate: summaries.reduce((sum, summary) => sum + summary.total_late, 0),
    totalAbsent: summaries.reduce((sum, summary) => sum + summary.total_absent, 0),
    totalEarly: summaries.reduce((sum, summary) => sum + summary.total_early, 0),
  }), [summaries])

  return {
    summaries,
    loading,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    expandedDept,
    memberRecords,
    loadingMembers,
    toggleDepartment,
    overallStats,
  }
}
