import { Clock, User, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { useAttendanceData } from '../hooks/useAttendanceData'

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

export function AttendancePage() {
  const {
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
  } = useAttendanceData()

  const attendanceRate = overallStats.expectedDays > 0
    ? (overallStats.actualDays / overallStats.expectedDays) * 100
    : 0

  if (loading && summaries.length === 0) {
    return (
      <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-10 text-center shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
        <Clock size={40} className="mx-auto text-gray-300 animate-spin" />
        <p className="text-gray-400 mt-4">加载中...</p>
      </div>
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
            {availableMonths.map((month) => (
              <option key={month} value={month}>{formatMonth(month)}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={User} label="统计人数" value={overallStats.employeeCount} color="blue" />
        <StatCard
          icon={CheckCircle2}
          label="整体出勤率"
          value={`${attendanceRate.toFixed(1)}%`}
          color={attendanceRate >= 95 ? 'green' : attendanceRate >= 90 ? 'yellow' : 'red'}
        />
        <StatCard icon={AlertCircle} label="迟到/早退" value={overallStats.totalLate + overallStats.totalEarly} color="yellow" />
        <StatCard icon={Clock} label="请假天数" value={overallStats.totalLeave.toFixed(1)} color="blue" />
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
              {summaries.map((summary) => (
                <>
                  <tr
                    key={summary.department_id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => void toggleDepartment(summary.department_id)}
                  >
                    <td className="py-3 px-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {expandedDept === summary.department_id ? (
                          <ChevronDown size={16} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                        {summary.department_name}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">{summary.parent_name || '-'}</td>
                    <td className="py-3 px-3 text-center text-gray-600">{summary.employee_count}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{summary.total_expected.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{summary.total_actual.toFixed(1)}</td>
                    <td className="py-3 px-3 text-center"><RateBadge rate={summary.rate} /></td>
                    <td className="py-3 px-3 text-right text-gray-600">{summary.total_leave.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{summary.total_late}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{summary.total_early}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{summary.total_absent.toFixed(1)}</td>
                  </tr>
                  {expandedDept === summary.department_id && (
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
                                {memberRecords.map((member) => (
                                  <tr key={member.id} className="border-b border-gray-100">
                                    <td className="py-2 px-2 text-gray-700">{member.member_name}</td>
                                    <td className="py-2 px-2 text-gray-600">{member.employee_no}</td>
                                    <td className="py-2 px-2 text-gray-600">{member.job_title || '-'}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{member.expected_days.toFixed(1)}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{member.actual_days.toFixed(1)}</td>
                                    <td className="py-2 px-2 text-center">
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        member.rate >= 95 ? 'bg-green-100 text-green-700' :
                                          member.rate >= 90 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                      }`}
                                      >
                                        {member.rate.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-right text-gray-600">{member.leave_days.toFixed(1)}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{member.late_times}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{member.early_leave_times}</td>
                                    <td className="py-2 px-2 text-right text-gray-600">{member.absent_days.toFixed(1)}</td>
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
