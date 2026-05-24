import { Banknote, ChevronDown, ChevronRight, CircleDollarSign, Search, TrendingUp, WalletCards } from 'lucide-react'
import { AppLoading } from '@/shared/ui/AppLoading'
import { DataEmptyState, DataErrorState } from '@/shared/components/data-state'
import { useCollectionData } from '../hooks/useCollectionData'
import type { CollectionTreeRow } from '../services/collectionTree'

const STAT_TONE = {
  blue: 'bg-accent-50 text-accent',
  green: 'bg-success-100 text-success-700',
  yellow: 'bg-warning-100 text-warning-700',
  red: 'bg-error-100 text-error-700',
} as const

function formatAmount(value: number | null | undefined) {
  const amount = value ?? 0
  return `${amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} 万`
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${(value * 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}

function getRateTone(value: number | null | undefined) {
  if (value == null) return 'bg-[rgba(15,23,42,0.06)] text-[var(--color-text-muted)]'
  if (value >= 1) return 'bg-success-100 text-success-700'
  if (value >= 0.8) return 'bg-warning-100 text-warning-700'
  return 'bg-error-100 text-error-700'
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
        <div className="mt-1 truncate text-title font-semibold leading-none text-gray-800">{value}</div>
      </div>
    </div>
  )
}

function TreeLabel({ row, expanded, expandable, onToggle }: {
  row: CollectionTreeRow
  expanded: boolean
  expandable: boolean
  onToggle: (key: string) => void
}) {
  const meta = row.children.length > 0 ? `${row.children.length} 项` : row.row.business_category ?? ''

  return (
    <div className="biz-data-table__business-cell-content" style={{ paddingLeft: `${row.depth * 20}px` }}>
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
      <span className={`truncate ${row.children.length > 0 ? 'font-medium text-[var(--color-text-strong)]' : 'font-normal text-[var(--color-text)]'}`}>
        {row.row.item_name}
      </span>
      {meta ? <span className="shrink-0 text-caption text-[var(--color-text-muted)]">{meta}</span> : null}
    </div>
  )
}

export function CollectionPage() {
  const {
    loading,
    refreshing,
    error,
    availablePeriods,
    selectedPeriod,
    setSelectedPeriod,
    query,
    setQuery,
    visibleRows,
    expandedKeys,
    expandableKeys,
    toggleRow,
    overallStats,
  } = useCollectionData()
  const root = overallStats.root

  if (loading && visibleRows.length === 0) {
    return <AppLoading label="加载回款数据..." variant="block" />
  }

  return (
    <div className="app-page">
      {error ? <DataErrorState message={error} /> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={WalletCards} label="本学年回款" value={formatAmount(root?.current_school_year_collection_amount)} color="green" />
        <StatCard icon={Banknote} label="剩余应收" value={formatAmount(root?.remaining_receivable)} color={(root?.remaining_receivable ?? 0) > 0 ? 'yellow' : 'green'} />
        <StatCard icon={TrendingUp} label="回款率" value={formatPercent(root?.collection_rate)} color={(root?.collection_rate ?? 0) >= 0.9 ? 'green' : 'yellow'} />
        <StatCard icon={CircleDollarSign} label="项目节点" value={overallStats.projectCount} color="blue" />
      </div>

      <section className="app-table-shell">
        <div className="app-table-toolbar">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="app-table-title">
              <WalletCards size={18} className="text-[var(--color-text-muted)]" />
              <h3>回款统计</h3>
              <span className="app-table-meta">{overallStats.rowCount} 条记录</span>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label className="relative w-full sm:w-[260px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="搜索项目、区域、业务板块..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="app-filter-control app-filter-search-input h-9"
                />
              </label>

              {availablePeriods.length > 0 && selectedPeriod ? (
                <select
                  value={selectedPeriod}
                  onChange={(event) => setSelectedPeriod(event.target.value)}
                  className="app-filter-control app-filter-select h-9 w-full sm:w-[220px]"
                >
                  {availablePeriods.map((period) => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        </div>

        {refreshing ? (
          <div className="px-3 pt-3 text-caption text-[var(--color-text-muted)]">正在刷新回款数据...</div>
        ) : null}

        <div className="app-table-scroll">
          <table className="app-data-table app-data-table-compact">
            <thead>
              <tr>
                <th className="text-left">项目 / 单位</th>
                <th className="text-right">上学年存量应收</th>
                <th className="text-right">本学年新增应收款</th>
                <th className="text-right">本学年回款金额</th>
                <th className="text-right">剩余应收</th>
                <th className="text-center">回款率</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key} className={row.children.length > 0 ? 'app-data-row-emphasis' : undefined}>
                  <td className="biz-data-table__business-cell">
                    <TreeLabel
                      row={row}
                      expanded={expandedKeys.has(row.key) || Boolean(query.trim())}
                      expandable={expandableKeys.has(row.key)}
                      onToggle={toggleRow}
                    />
                  </td>
                  <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.row.prior_school_year_receivable)}</td>
                  <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.row.current_school_year_new_receivable)}</td>
                  <td className="app-cell-strong app-cell-numeric text-right">{formatAmount(row.row.current_school_year_collection_amount)}</td>
                  <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.row.remaining_receivable)}</td>
                  <td className="text-center">
                    <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${getRateTone(row.row.collection_rate)}`}>
                      {formatPercent(row.row.collection_rate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleRows.length === 0 && !loading ? (
          <DataEmptyState title="暂无回款数据" description={query ? '请调整搜索条件。' : '请先运行回款导入脚本。'} />
        ) : null}
      </section>
    </div>
  )
}
