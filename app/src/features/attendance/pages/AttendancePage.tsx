import { Fragment } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, User } from 'lucide-react'
import { useAttendanceData } from '../hooks/useAttendanceData'

function RateBadge({ rate }: { rate: number }) {
  const style = rate >= 95 ? 'bg-green-100 text-green-700' : rate >= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`rounded font-medium text-caption px-2 py-0.5 ${style}`}>{rate.toFixed(1)}%</span>
}

const STAT_TONE = {
  blue: 'bg-accent-50 text-accent',
  green: 'bg-success-100 text-success-700',
  yellow: 'bg-warning-100 text-warning-700',
  red: 'bg-error-100 text-error-700',
} as const

function StatCard({ icon: Icon, label, value, color = 'blue' }: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: keyof typeof STAT_TONE
}) {
  return (
    <div className="app-metric-card relative flex min-h-[88px] items-center gap-3 px-3.5 py-3 sm:min-h-[94px] sm:px-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ${STAT_TONE[color]}`}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-caption font-semibold uppercase tracking-[0.14em] text-gray-500">
          {label}
        </div>
        <div className="mt-1 truncate text-title font-semibold leading-none text-gray-800">
          {value}
        </div>
      </div>
    </div>
  )
}

function MemberAttendanceCard({ member }: {
  member: {
    id: string
    member_name: string
    employee_no: string | null
    job_title: string | null
    expected_days: number
    actual_days: number
    rate: number
    leave_days: number
    late_times: number
    early_leave_times: number
    absent_days: number
  }
}) {
  return (
    <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/92 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-[var(--color-text-strong)]">{member.member_name}</div>
          <div className="mt-1 text-caption text-[var(--color-text-muted)]">
            {[member.employee_no, member.job_title].filter(Boolean).join(' · ') || '暂无岗位信息'}
          </div>
        </div>
        <RateBadge rate={member.rate} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-caption">
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">应出勤 {member.expected_days.toFixed(1)}</div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">实出勤 {member.actual_days.toFixed(1)}</div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">请假 {member.leave_days.toFixed(1)}</div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">迟到/早退 {member.late_times + member.early_leave_times}</div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">迟到 {member.late_times}</div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">旷工 {member.absent_days.toFixed(1)}</div>
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
        <p className="mt-4 text-gray-400">加载中...</p>
      </div>
    )
  }

  const formatMonth = (ym: number) => {
    const year = Math.floor(ym / 100)
    const month = ym % 100
    return `${year}年${month}月`
  }

  return (
    <div className="app-page">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

      <section className="app-table-shell">
        <div className="app-table-toolbar">
          <div className="app-table-title">
            <Clock size={18} className="text-[var(--color-text-muted)]" />
            <h3>部门考勤汇总</h3>
          </div>
          {availableMonths.length > 0 && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="select select-sm ml-auto w-full sm:w-auto sm:min-w-[180px]"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>{formatMonth(month)}</option>
              ))}
            </select>
          )}
        </div>
        <div className="lg:hidden space-y-3 px-3 py-3">
          {summaries.map((summary) => (
            <div
              key={summary.department_id}
              className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-white/92 p-4"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => void toggleDepartment(summary.department_id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium text-[var(--color-text-strong)]">
                    {expandedDept === summary.department_id ? (
                      <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
                    ) : (
                      <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                    )}
                    <span className="truncate">{summary.department_name}</span>
                  </div>
                  <div className="mt-1 text-caption text-[var(--color-text-muted)]">
                    {summary.parent_name || '无上级部门'}
                  </div>
                </div>
                <RateBadge rate={summary.rate} />
              </button>

              <div className="mt-3 grid grid-cols-2 gap-2 text-caption">
                <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">人数 {summary.employee_count}</div>
                <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">应出勤 {summary.total_expected.toFixed(1)}</div>
                <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">实出勤 {summary.total_actual.toFixed(1)}</div>
                <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">请假 {summary.total_leave.toFixed(1)}</div>
                <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">迟到/早退 {summary.total_late + summary.total_early}</div>
                <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-[var(--color-text-muted)]">旷工 {summary.total_absent.toFixed(1)}</div>
              </div>

              {expandedDept === summary.department_id && (
                <div className="mt-3 rounded-2xl bg-[rgba(15,23,42,0.03)] p-3">
                  {loadingMembers ? (
                    <div className="py-4 text-center text-[var(--color-text-muted)]">加载中...</div>
                  ) : memberRecords.length > 0 ? (
                    <div className="space-y-2">
                      {memberRecords.map((member) => (
                        <MemberAttendanceCard key={member.id} member={member} />
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-[var(--color-text-muted)]">暂无成员记录</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {summaries.length === 0 && !loading && (
            <div className="py-8 text-center text-[var(--color-text-muted)]">
              暂无考勤数据
            </div>
          )}
        </div>
        <div className="app-table-scroll hidden lg:block">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="text-left">部门</th>
                <th className="text-left">上级部门</th>
                <th className="text-center">人数</th>
                <th className="text-right">应出勤</th>
                <th className="text-right">实出勤</th>
                <th className="text-center">出勤率</th>
                <th className="text-right">请假</th>
                <th className="text-right">迟到</th>
                <th className="text-right">早退</th>
                <th className="text-right">旷工</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <Fragment key={summary.department_id}>
                  <tr
                    className="app-data-row-interactive"
                    onClick={() => void toggleDepartment(summary.department_id)}
                  >
                    <td className="font-medium text-[var(--color-text-strong)]">
                      <div className="flex items-center gap-2">
                        {expandedDept === summary.department_id ? (
                          <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
                        ) : (
                          <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                        )}
                        {summary.department_name}
                      </div>
                    </td>
                    <td className="app-cell-muted">{summary.parent_name || '-'}</td>
                    <td className="app-cell-muted app-cell-numeric text-center">{summary.employee_count}</td>
                    <td className="app-cell-muted app-cell-numeric text-right">{summary.total_expected.toFixed(1)}</td>
                    <td className="app-cell-muted app-cell-numeric text-right">{summary.total_actual.toFixed(1)}</td>
                    <td className="text-center"><RateBadge rate={summary.rate} /></td>
                    <td className="app-cell-muted app-cell-numeric text-right">{summary.total_leave.toFixed(1)}</td>
                    <td className="app-cell-muted app-cell-numeric text-right">{summary.total_late}</td>
                    <td className="app-cell-muted app-cell-numeric text-right">{summary.total_early}</td>
                    <td className="app-cell-muted app-cell-numeric text-right">{summary.total_absent.toFixed(1)}</td>
                  </tr>
                  {expandedDept === summary.department_id && (
                    <tr className="app-data-row-emphasis app-data-row-static">
                      <td colSpan={10} className="p-0">
                        <div className="px-6 py-4">
                          {loadingMembers ? (
                            <div className="py-4 text-center text-[var(--color-text-muted)]">加载中...</div>
                          ) : memberRecords.length > 0 ? (
                            <div className="app-table-subtable app-table-scroll">
                              <table className="app-data-table app-data-table-compact">
                                <thead>
                                  <tr>
                                    <th className="text-left">姓名</th>
                                    <th className="text-left">工号</th>
                                    <th className="text-left">职位</th>
                                    <th className="text-right">应出勤</th>
                                    <th className="text-right">实出勤</th>
                                    <th className="text-center">出勤率</th>
                                    <th className="text-right">请假</th>
                                    <th className="text-right">迟到</th>
                                    <th className="text-right">早退</th>
                                    <th className="text-right">旷工</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {memberRecords.map((member) => (
                                    <tr key={member.id}>
                                      <td className="app-cell-strong">{member.member_name}</td>
                                      <td className="app-cell-muted">{member.employee_no}</td>
                                      <td className="app-cell-muted">{member.job_title || '-'}</td>
                                      <td className="app-cell-muted app-cell-numeric text-right">{member.expected_days.toFixed(1)}</td>
                                      <td className="app-cell-muted app-cell-numeric text-right">{member.actual_days.toFixed(1)}</td>
                                      <td className="text-center">
                                        <RateBadge rate={member.rate} />
                                      </td>
                                      <td className="app-cell-muted app-cell-numeric text-right">{member.leave_days.toFixed(1)}</td>
                                      <td className="app-cell-muted app-cell-numeric text-right">{member.late_times}</td>
                                      <td className="app-cell-muted app-cell-numeric text-right">{member.early_leave_times}</td>
                                      <td className="app-cell-muted app-cell-numeric text-right">{member.absent_days.toFixed(1)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="py-4 text-center text-[var(--color-text-muted)]">暂无成员记录</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {summaries.length === 0 && !loading && (
            <div className="py-8 text-center text-[var(--color-text-muted)]">
              暂无考勤数据
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
