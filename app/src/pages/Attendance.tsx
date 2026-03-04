import { useState, useEffect } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { supabase, type DepartmentAttendanceSummary } from '@/lib/supabase'
import { Clock, Calendar, User, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

function RateBadge({ rate }: { rate: number }) {
  const style = rate >= 95 ? 'bg-success-100 text-success-700' : rate >= 90 ? 'bg-warning-100 text-warning-700' : 'bg-error-100 text-error-700'
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${style}`}>{rate.toFixed(1)}%</span>
}

function StatCard({ icon: Icon, label, value, trend, color = 'primary' }: {
  icon: React.ElementType
  label: string
  value: string | number
  trend?: { value: string; up?: boolean }
  color?: 'primary' | 'success' | 'warning' | 'error'
}) {
  const colorClass = {
    primary: 'bg-primary-50 text-primary',
    success: 'bg-success-50 text-success',
    warning: 'bg-warning-50 text-warning',
    error: 'bg-error-50 text-error'
  }[color]

  return (
    <div className="bg-surface rounded-lg border border-gray-200 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon size={20} strokeWidth={1.5} />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.up ? 'text-success' : 'text-error'}`}>
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-semibold text-gray-800">{value}</div>
        <div className="text-xs text-gray-600 mt-1">{label}</div>
      </div>
    </div>
  )
}

function getMonthName(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function Attendance() {
  const [summaries, setSummaries] = useState<DepartmentAttendanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('2026-01')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])

  // 总体统计
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
      .select('period_start')
      .order('period_start', { ascending: false })

    const months = new Set(data?.map(d => d.period_start?.substring(0, 7)) || [])
    setAvailableMonths(Array.from(months).sort())
    if (months.size > 0 && !selectedMonth) {
      setSelectedMonth(Array.from(months)[0])
    }
  }

  const fetchAttendanceData = async () => {
    setLoading(true)
    const monthStart = `${selectedMonth}-01`
    const monthEnd = `${selectedMonth}-31`

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        employees:employee_id (
          id, name, department, company
        )
      `)
      .gte('period_start', monthStart)
      .lte('period_end', monthEnd)

    if (error) {
      console.error('获取考勤数据失败:', error)
      setLoading(false)
      return
    }

    // 按部门汇总
    const deptMap = new Map<string, DepartmentAttendanceSummary>()

    data?.forEach((record: any) => {
      const dept = record.employees?.department || '未分类'
      const empCount = 1
      const expected = Number(record.expected_days) || 0
      const actual = Number(record.actual_days) || 0

      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          employee_count: 0,
          total_expected: 0,
          total_actual: 0,
          rate: 0,
          total_leave: 0,
          total_late: 0,
          total_early: 0,
          total_absent: 0,
          total_overtime: 0,
        })
      }

      const summary = deptMap.get(dept)!
      summary.employee_count += empCount
      summary.total_expected += expected
      summary.total_actual += actual
      summary.total_leave +=
        (Number(record.personal_leave) || 0) +
        (Number(record.sick_leave) || 0) +
        (Number(record.annual_leave) || 0) +
        (Number(record.other_leave) || 0)
      summary.total_late += Number(record.late_times) || 0
      summary.total_early += Number(record.early_leave_times) || 0
      summary.total_absent += Number(record.absent_days) || 0
      summary.total_overtime += Number(record.overtime_days) || 0
    })

    // 计算出勤率
    const result = Array.from(deptMap.values()).map(s => ({
      ...s,
      rate: s.total_expected > 0 ? (s.total_actual / s.total_expected) * 100 : 0,
    })).sort((a, b) => b.total_actual - a.total_actual)

    setSummaries(result)
    setLoading(false)
  }

  if (loading && summaries.length === 0) {
    return (
      <>
        <PageTitle breadcrumb="业务管理 / 考勤管理" title="考勤管理" />
        <div className="bg-surface rounded-lg border border-gray-200 p-10 text-center">
          <Clock size={40} strokeWidth={1} className="mx-auto text-gray-300 animate-spin" />
          <p className="text-gray-400 mt-4">加载中...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle breadcrumb="业务管理 / 考勤管理" title="考勤管理">
        {availableMonths.length > 0 && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="ml-4 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{getMonthName(`${m}-01`)}</option>
            ))}
          </select>
        )}
      </PageTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={User}
          label="统计人数"
          value={overallStats.employeeCount}
          color="primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="整体出勤率"
          value={`${attendanceRate.toFixed(1)}%`}
          trend={attendanceRate >= 95 ? { value: '达标', up: true } : attendanceRate >= 90 ? { value: '注意', up: true } : undefined}
          color={attendanceRate >= 95 ? 'success' : attendanceRate >= 90 ? 'warning' : 'error'}
        />
        <StatCard
          icon={AlertCircle}
          label="迟到/早退"
          value={overallStats.totalLate + overallStats.totalEarly}
          color="warning"
        />
        <StatCard
          icon={TrendingUp}
          label="加班天数"
          value={summaries.reduce((sum, s) => sum + s.total_overtime, 0).toFixed(1)}
          color="primary"
        />
      </div>

      <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} strokeWidth={1.5} className="text-gray-600" />
          <h3 className="font-medium text-gray-800">部门考勤汇总</h3>
          {availableMonths.length > 0 && (
            <span className="text-xs text-gray-500 ml-2">{getMonthName(`${selectedMonth}-01`)}</span>
          )}
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
                <th className="text-right py-3 px-3 font-medium text-gray-700">加班</th>
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
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_overtime.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_leave.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_late.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{s.total_early.toFixed(1)}</td>
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
