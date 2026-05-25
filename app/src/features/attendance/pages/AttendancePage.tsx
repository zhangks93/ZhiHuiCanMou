import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock, Search, User } from 'lucide-react'
import { AppLoading } from '@/shared/ui/AppLoading'
import { DataEmptyState, DataErrorState } from '@/shared/components/data-state'
import { useAttendanceData, type AttendanceTreeRow } from '../hooks/useAttendanceData'

const RATE_TONE = {
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-error-100 text-error-700',
} as const

const STAT_TONE = {
  blue: 'bg-accent-50 text-accent',
  green: 'bg-success-100 text-success-700',
  yellow: 'bg-warning-100 text-warning-700',
  red: 'bg-error-100 text-error-700',
} as const

function formatMonth(ym: number) {
  const year = Math.floor(ym / 100)
  const month = ym % 100
  return `${year}年${month}月`
}

function formatPercent(value: number) {
  return `${(value * 100).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%`
}

function formatLatePercent(value: number) {
  return `${(value * 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function getRateTone(rate: number): keyof typeof RATE_TONE {
  if (rate >= 0.98) return 'success'
  if (rate >= 0.95) return 'warning'
  return 'danger'
}

function RateBadge({ rate }: { rate: number }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${RATE_TONE[getRateTone(rate)]}`}>
      {formatPercent(rate)}
    </span>
  )
}

function CountRateCell({ count, rate }: { count: number; rate: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="app-cell-numeric text-[var(--color-text)]">{formatNumber(count)}</span>
      <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-2 py-0.5 text-caption font-medium text-[var(--color-text-muted)]">
        {formatLatePercent(rate)}
      </span>
    </div>
  )
}

function AttendanceRateHeader() {
  return (
    <span className="inline-flex items-center justify-center gap-1">
      出勤率
      <CircleHelp
        size={14}
        className="text-[var(--color-text-muted)]"
        aria-label="出勤率计算逻辑"
        role="img"
      >
        <title>出勤率仅计入全薪假、带薪/全薪寒暑假、产假、居家/线上办公和法定节假日；事假、病假、长病假、超休不计入。</title>
      </CircleHelp>
    </span>
  )
}

function WorkTypeBadge({ type }: { type: string | undefined }) {
  const label = type === 'standard_day' ? '按天' : type === 'comprehensive_hour' ? '按小时' : '部门'
  return (
    <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-2 py-0.5 text-caption font-medium text-[var(--color-text-muted)]">
      {label}
    </span>
  )
}

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
        <div className="text-caption font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
        <div className="mt-1 truncate text-title font-semibold leading-none text-gray-800" title={String(value)}>{value}</div>
      </div>
    </div>
  )
}

function getRowLabelMeta(row: AttendanceTreeRow) {
  if (row.level === 'member') {
    return [row.member?.employee_no, row.member?.attendance_type === 'standard_day' ? '按天岗位' : '按小时岗位']
      .filter(Boolean)
      .join(' · ')
  }
  return ''
}

function TreeLabel({ row, expanded, expandable, onToggle }: {
  row: AttendanceTreeRow
  expanded: boolean
  expandable: boolean
  onToggle: (key: string) => void
}) {
  return (
    <div className="biz-data-table__business-cell-content" style={{ paddingLeft: `${row.depth * 18}px` }}>
      {expandable ? (
        <button
          type="button"
          onClick={() => onToggle(row.key)}
          className="rounded-md p-0.5 transition-colors hover:bg-[rgba(34,197,94,0.08)]"
        >
          {expanded ? (
            <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
          )}
        </button>
      ) : (
        <span className="w-[18px]" />
      )}
      <div className="min-w-0">
        <div className={`truncate ${row.level === 'member' ? 'font-normal text-[var(--color-text)]' : 'font-medium text-[var(--color-text-strong)]'}`}>
          {row.name}
        </div>
        {getRowLabelMeta(row) ? (
          <div className="mt-0.5 truncate text-caption text-[var(--color-text-muted)]">{getRowLabelMeta(row)}</div>
        ) : null}
      </div>
    </div>
  )
}

export function AttendancePage() {
  const {
    loading,
    error,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    expandedKeys,
    query,
    setQuery,
    visibleRows,
    expandableKeys,
    toggleRow,
    overallStats,
  } = useAttendanceData()

  if (loading && visibleRows.length === 0) {
    return <AppLoading label="加载考勤数据..." variant="block" />
  }

  return (
    <div className="app-page">
      {error ? <DataErrorState message={error} /> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={User} label="统计人数" value={formatNumber(overallStats.employeeCount)} color="blue" />
        <StatCard
          icon={CheckCircle2}
          label="整体出勤率"
          value={formatPercent(overallStats.averageAttendanceRate)}
          color={overallStats.averageAttendanceRate >= 0.98 ? 'green' : overallStats.averageAttendanceRate >= 0.95 ? 'yellow' : 'red'}
        />
        <StatCard icon={AlertCircle} label="迟到率" value={formatPercent(overallStats.lateRate)} color="yellow" />
        <StatCard icon={Clock} label="迟到/早退次数" value={formatNumber(overallStats.lateTotalCount)} color="yellow" />
      </div>

      <section className="app-table-shell">
        <div className="app-table-toolbar">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="app-table-title">
              <Clock size={18} className="text-[var(--color-text-muted)]" />
              <h3>部门考勤总览</h3>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label className="relative w-full sm:w-[240px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="搜索部门、姓名、工号..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="app-filter-control app-filter-search-input h-9"
                />
              </label>

              {availableMonths.length > 0 && selectedMonth ? (
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(Number(event.target.value))}
                  className="app-filter-control app-filter-select h-9 w-full sm:w-[150px]"
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>{formatMonth(month)}</option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        </div>

        <div className="app-table-scroll">
          <table className="app-data-table app-data-table-compact">
            <thead>
              <tr>
                <th className="text-left">部门 / 人员</th>
                <th className="text-center">类型</th>
                <th className="text-right">人数</th>
                <th className="text-right">日岗</th>
                <th className="text-right">时岗</th>
                <th className="text-center"><AttendanceRateHeader /></th>
                <th className="text-right">迟到早退半小时内 次数/比率</th>
                <th className="text-right">迟到早退超半小时 次数/比率</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key} className={row.level !== 'member' ? 'app-data-row-emphasis' : undefined}>
                  <td className="biz-data-table__business-cell">
                    <TreeLabel
                      row={row}
                      expanded={expandedKeys.has(row.key) || Boolean(query.trim())}
                      expandable={expandableKeys.has(row.key)}
                      onToggle={toggleRow}
                    />
                  </td>
                  <td className="text-center"><WorkTypeBadge type={row.member?.attendance_type} /></td>
                  <td className="app-cell-muted app-cell-numeric text-right">{formatNumber(row.metrics.employeeCount)}</td>
                  <td className="app-cell-muted app-cell-numeric text-right">{formatNumber(row.metrics.dayEmployeeCount)}</td>
                  <td className="app-cell-muted app-cell-numeric text-right">{formatNumber(row.metrics.hourEmployeeCount)}</td>
                  <td className="text-center"><RateBadge rate={row.metrics.averageAttendanceRate} /></td>
                  <td className="app-cell-muted text-right">
                    <CountRateCell count={row.metrics.lateUnder30Count} rate={row.metrics.lateUnder30Rate} />
                  </td>
                  <td className="app-cell-muted text-right">
                    <CountRateCell count={row.metrics.lateOver30Count} rate={row.metrics.lateOver30Rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleRows.length === 0 && !loading ? (
          <DataEmptyState title="暂无考勤数据" description={query ? '请调整搜索条件。' : '请先导入人资月度考勤文件。'} />
        ) : null}
      </section>
    </div>
  )
}
