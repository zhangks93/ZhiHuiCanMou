import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, User, AlertCircle, CheckCircle2 } from 'lucide-react'

interface DeptSummary {
  department: string
  employee_count: number
  total_expected: number
  total_actual: number
  total_leave: number
  total_absent: number
  total_late: number
  total_early: number
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
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

  useEffect(() => {
    fetchAvailableMonths()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      fetchAttendanceData()
    }
  }, [selectedMonth])

  const fetchAvailableMonths = async () => {
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

  const fetchAttendanceData = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        feishu_members:employee_id (
          name,
          employee_no,
          job_title,
          department_id
        )
      `)
      .eq('year_month', selectedMonth)

    if (error) {
      console.error('获取考勤数据失败:', error)
      setLoading(false)
      return
    }

    // 获取所有部门信息
    const { data: departments } = await supabase
      .from('feishu_departments')
      .select('department_id, name')

    const deptMap = new Map<string, string>()
    departments?.forEach(d => {
      deptMap.set(d.department_id, d.name)
    })

    const summaryMap = new Map<string, DeptSummary>()

    data?.forEach((record: any) => {
      const member = record.feishu_members
      if (!member) return

      // 获取员工的第一个部门
      const deptIds = member.department_id?.split(',') || []
      const deptId = deptIds[0]
      const deptName = deptMap.get(deptId) || '未分类'

      if (!summaryMap.has(deptName)) {
        summaryMap.set(deptName, {
          department: deptName,
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

      const summary = summaryMap.get(deptName)!
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
    })).sort((a, b) => b.total_actual - a.total_actual)

    setSummaries(result)
    setLoading(false)
  }

  if (loading && summaries.length === 0) {
    return (
      <>
        <div className="mb-6 animate-slide-up">
          <div className="text-sm text-[var(--color-text-muted)] mb-0.5 font-medium">
            业务管理 / 考勤管理
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-strong)] font-serif tracking-tight">
            考勤管理
          </h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
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
      <div className="mb-6 animate-slide-up">
        <div className="text-sm text-[var(--color-text-muted)] mb-0.5 font-medium">
          业务管理 / 考勤管理
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl font-semibold text-[var(--color-text-strong)] font-serif tracking-tight">
            考勤管理
          </h1>
          {availableMonths.length > 0 && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          )}
        </div>
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

      <div className="bg-white rounded-lg border border-gray-200 p-5">
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
                <tr key={s.department} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium text-gray-800">{s.department}</td>
                  <td className="py-3 px-3 text-center text-gray-600">{s.employee_count}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_expected.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_actual.toFixed(1)}</td>
                  <td className="py-3 px-3 text-center"><RateBadge rate={s.rate} /></td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_leave.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_late}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_early}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_absent.toFixed(1)}</td>
                </tr>
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
