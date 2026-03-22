import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, User, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'

interface DeptSummary {
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

interface MemberRecord {
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

function RateBadge({ rate }: { rate: number }) {
  const style = rate >= 95 ? 'bg-green-100 text-green-700' : rate >= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${style}`}>{rate.toFixed(1)}%</span>
}

function StatCard({ icon: Icon, label, value, color = 'blue' }: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="bg-white/86 backdrop-blur-xl rounded-[18px] border border-[var(--color-border)] p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600 w-fit`}>
        <Icon size={20} />
      </div>
      <div className="mt-3">
        <div className="text-2xl font-semibold text-gray-800">{value}</div>
        <div className="text-xs text-gray-600 mt-1">{label}</div>
      </div>
    </div>
  )
}

export function Attendance() {
  const [summaries, setSummaries] = useState<DeptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(202601)
  const [availableMonths, setAvailableMonths] = useState<number[]>([])
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [memberRecords, setMemberRecords] = useState<MemberRecord[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const overallStats = {
    employeeCount: summaries.reduce((sum, s) => sum + s.employee_count, 0),
    expectedDays: summaries.reduce((sum, s) => sum + s.total_expected, 0),
    actualDays: summaries.reduce((sum, s) => sum + s.total_actual, 0),
    totalLeave: summaries.reduce((sum, s) => sum + s.total_leave, 0),
    totalLate: summaries.reduce((sum, s) => sum + s.total_late, 0),
    totalAbsent: summaries.reduce((sum, s) => sum + s.total_absent, 0),
  }

  const attendanceRate = overallStats.expectedDays > 0
    ? (overallStats.actualDays / overallStats.expectedDays) * 100
    : 0

  const fetchMemberRecords = async (deptId: string) => {
    setLoadingMembers(true)
    const { data, error } = await supabase
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

    if (error) {
      console.error('获取成员记录失败:', error)
      setLoadingMembers(false)
      return
    }

    const records: MemberRecord[] = data?.map((r: Record<string, unknown>) => {
      const member = r.feishu_members as { name?: string; employee_no?: string; job_title?: string } | null
      return {
      id: r.id as string,
      member_name: member?.name || '未知',
      employee_no: member?.employee_no || '-',
      job_title: member?.job_title || null,
      expected_days: Number(r.expected_days) || 0,
      actual_days: Number(r.actual_days) || 0,
      leave_days: Number(r.leave_days) || 0,
      absent_days: Number(r.absent_days) || 0,
      late_times: Number(r.late_times) || 0,
      early_leave_times: Number(r.early_leave_times) || 0,
      rate: Number(r.expected_days) > 0 ? (Number(r.actual_days) / Number(r.expected_days)) * 100 : 0,
    }}) || []

    setMemberRecords(records)
    setLoadingMembers(false)
  }

  useEffect(() => {
    const loadMonths = async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('year_month')
        .order('year_month', { ascending: false })

      const months = [...new Set(data?.map(d => d.year_month) || [])]
      setAvailableMonths(months)
      if (months.length > 0) {
        setSelectedMonth(months[0])
      }
    }
    void loadMonths()
  }, [])

  useEffect(() => {
    if (!selectedMonth) return

    const loadData = async () => {
      setLoading(true)

      // 获取考勤记录（已包含部门关联）
      const { data, error } = await supabase
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
        .eq('year_month', selectedMonth)

      if (error) {
        console.error('获取考勤数据失败:', error)
        setLoading(false)
        return
      }

      // 获取所有部门信息用于查找父部门
      const { data: allDepts } = await supabase
        .from('feishu_departments')
        .select('department_id, name, parent_id')

      const deptMap = new Map<string, { name: string; parent_id: string | null }>()
      allDepts?.forEach(d => {
        deptMap.set(d.department_id, { name: d.name, parent_id: d.parent_id })
      })

      const summaryMap = new Map<string, DeptSummary>()

      data?.forEach((record: Record<string, unknown>) => {
        const dept = record.feishu_departments as { department_id: string; name: string; parent_id: string | null } | null
        if (!dept) return

        const deptId = dept.department_id
        const deptName = dept.name
        const parentInfo = dept.parent_id ? deptMap.get(dept.parent_id) : null
        const parentName = parentInfo?.name || null

        if (!summaryMap.has(deptId)) {
          summaryMap.set(deptId, {
            department_id: deptId,
            department_name: deptName,
            parent_name: parentName,
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

        const summary = summaryMap.get(deptId)!
        summary.employee_count += 1
        summary.total_expected += Number(record.expected_days) || 0
        summary.total_actual += Number(record.actual_days) || 0
        summary.total_leave += Number(record.leave_days) || 0
        summary.total_absent += Number(record.absent_days) || 0
        summary.total_late += Number(record.late_times) || 0
        summary.total_early += Number(record.early_leave_times) || 0
      })

      const result = Array.from(summaryMap.values()).map(s => ({
        ...s,
        rate: s.total_expected > 0 ? (s.total_actual / s.total_expected) * 100 : 0,
      })).sort((a, b) => b.rate - a.rate)

      setSummaries(result)
      setLoading(false)
    }

    void loadData()
  }, [selectedMonth])

  const toggleDepartment = (deptId: string) => {
    if (expandedDept === deptId) {
      setExpandedDept(null)
      setMemberRecords([])
    } else {
      setExpandedDept(deptId)
      fetchMemberRecords(deptId)
    }
  }

  if (loading && summaries.length === 0) {
    return (
      <>
        <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-10 text-center shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
          <Clock size={40} className="mx-auto text-gray-300 animate-spin" />
          <p className="text-gray-400 mt-4">加载中...</p>
        </div>
      </>
    )
  }

  const formatMonth = (ym: number) => {
    const year = Math.floor(ym / 100)
    const month = ym % 100
    return `${year}年${month}月`
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        {availableMonths.length > 0 && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-xl bg-white/86 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={User}
          label="统计人数"
          value={overallStats.employeeCount}
          color="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="整体出勤率"
          value={`${attendanceRate.toFixed(1)}%`}
          color={attendanceRate >= 95 ? 'green' : attendanceRate >= 90 ? 'yellow' : 'red'}
        />
        <StatCard
          icon={AlertCircle}
          label="迟到/早退"
          value={overallStats.totalLate + summaries.reduce((sum, s) => sum + s.total_early, 0)}
          color="yellow"
        />
        <StatCard
          icon={Clock}
          label="请假天数"
          value={overallStats.totalLeave.toFixed(1)}
          color="blue"
        />
      </div>

      <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-gray-600" />
          <h3 className="font-medium text-gray-800">部门考勤汇总</h3>
          <span className="text-xs text-gray-500 ml-2">{formatMonth(selectedMonth)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left py-3 px-3 font-medium text-gray-700">部门</th>
                <th className="text-left py-3 px-3 font-medium text-gray-700">上级部门</th>
                <th className="text-center py-3 px-3 font-medium text-gray-700">人数</th>
                <th className="text-right py-3 px-3 font-medium text-gray-700">应出勤</th>
                <th className="text-right py-3 px-3 font-medium text-gray-700">实出勤</th>
                <th className="text-center py-3 px-3 font-medium text-gray-700">出勤率</th>
                <th className="text-right py-3 px-3 font-medium text-gray-700">请假</th>
                <th className="text-right py-3 px-3 font-medium text-gray-700">迟到</th>
                <th className="text-right py-3 px-3 font-medium text-gray-700">早退</th>
                <th className="text-right py-3 px-3 font-medium text-gray-700">旷工</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <>
                  <tr
                    key={s.department_id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleDepartment(s.department_id)}
                  >
                    <td className="py-3 px-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {expandedDept === s.department_id ? (
                          <ChevronDown size={16} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                        {s.department_name}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">
                      {s.parent_name || '-'}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600">{s.employee_count}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{s.total_expected.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{s.total_actual.toFixed(1)}</td>
                    <td className="py-3 px-3 text-center"><RateBadge rate={s.rate} /></td>
                    <td className="py-3 px-3 text-right text-gray-600">{s.total_leave.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{s.total_late}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{s.total_early}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{s.total_absent.toFixed(1)}</td>
                  </tr>
                  {expandedDept === s.department_id && (
                    <tr>
                      <td colSpan={10} className="bg-gray-50 p-0">
                        <div className="px-8 py-4">
                          {loadingMembers ? (
                            <div className="text-center py-4 text-gray-400">加载中...</div>
                          ) : memberRecords.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">姓名</th>
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">工号</th>
                                  <th className="text-left py-2 px-2 font-medium text-gray-600">职位</th>
                                  <th className="text-right py-2 px-2 font-medium text-gray-600">应出勤</th>
                                  <th className="text-right py-2 px-2 font-medium text-gray-600">实出勤</th>
                                  <th className="text-center py-2 px-2 font-medium text-gray-600">出勤率</th>
                                  <th className="text-right py-2 px-2 font-medium text-gray-600">请假</th>
                                  <th className="text-right py-2 px-2 font-medium text-gray-600">迟到</th>
                                  <th className="text-right py-2 px-2 font-medium text-gray-600">早退</th>
                                  <th className="text-right py-2 px-2 font-medium text-gray-600">旷工</th>
                                </tr>
                              </thead>
                              <tbody>
                                {memberRecords.map((m) => (
                                  <tr key={m.id} className="border-b border-gray-100">
                                    <td className="py-2 px-2 text-gray-700">{m.member_name}</td>
                                    <td className="py-2 px-2 text-gray-600">{m.employee_no}</td>
                                    <td className="py-2 px-2 text-gray-600">{m.job_title || '-'}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{m.expected_days.toFixed(1)}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{m.actual_days.toFixed(1)}</td>
                                    <td className="py-2 px-2 text-center">
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        m.rate >= 95 ? 'bg-green-100 text-green-700' :
                                        m.rate >= 90 ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        {m.rate.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-right text-gray-600">{m.leave_days.toFixed(1)}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{m.late_times}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{m.early_leave_times}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{m.absent_days.toFixed(1)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-center py-4 text-gray-400">暂无成员记录</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {summaries.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-400">
              暂无考勤数据
            </div>
          )}
        </div>
      </div>
    </>
  )
}
