import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Search,
  X,
  TrendingUp,
  CheckCircle2,
  Building2,
  Clock3,
} from 'lucide-react'
import type { OpportunityLedger } from '@/lib/supabase'
import { AppLoading } from '@/components/ui/AppLoading'
import { useOpportunityData } from '../hooks/useOpportunityData'

// ─── Stage config ────────────────────────────────────────────────────────────

type StageCode = string

const STAGE_ORDER: StageCode[] = [
  'contracted',
  'customer_approval',
  'internal_approval',
  'opportunity',
  'lead',
]

const STAGE_LABEL: Record<StageCode, string> = {
  lead: '线索',
  opportunity: '商机',
  internal_approval: '内部投决',
  customer_approval: '客户投决',
  contracted: '签约',
}

const STAGE_STYLE: Record<StageCode, { bg: string; text: string; dot: string; icon: typeof Circle }> = {
  lead: {
    bg: 'bg-[rgba(148,163,184,0.08)]',
    text: 'text-[#64748b]',
    dot: 'bg-[#94a3b8]',
    icon: Search,
  },
  opportunity: {
    bg: 'bg-[rgba(37,99,235,0.08)]',
    text: 'text-[var(--color-accent-hover)]',
    dot: 'bg-[var(--color-accent-hover)]',
    icon: Clock3,
  },
  internal_approval: {
    bg: 'bg-[rgba(217,119,6,0.10)]',
    text: 'text-[#a55406]',
    dot: 'bg-[#d97706]',
    icon: Building2,
  },
  customer_approval: {
    bg: 'bg-[rgba(168,85,247,0.08)]',
    text: 'text-[#7c3aed]',
    dot: 'bg-[#a855f7]',
    icon: Clock3,
  },
  contracted: {
    bg: 'bg-[rgba(15,159,110,0.10)]',
    text: 'text-[#08724d]',
    dot: 'bg-[#10b981]',
    icon: CheckCircle2,
  },
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatWan(value: number | null): string {
  if (value == null) return '-'
  if (value >= 10000) return `${(value / 10000).toFixed(1)}亿`
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}万`
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

// ─── Funnel Stage Bar ────────────────────────────────────────────────────────

interface StageStat {
  stage_code: StageCode
  label: string
  count: number
  revenue: number
}

interface FunnelBarProps {
  stages: StageStat[]
  totalRevenue: number
}

function FunnelBar({ stages, totalRevenue }: FunnelBarProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/90 shadow-[var(--shadow-xs)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(148,163,184,0.10)] px-5 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-[var(--color-accent-hover)]" />
          <span className="text-xs font-semibold text-[var(--color-text-strong)]">商机漏斗</span>
        </div>
        <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
          总预期营收 <span className="font-semibold text-[var(--color-text-strong)]">{formatWan(totalRevenue)}</span>
        </span>
      </div>

      {/* Stages */}
      <div className="flex divide-x divide-[rgba(148,163,184,0.08)]">
        {stages.map((stage) => {
          const style = STAGE_STYLE[stage.stage_code] ?? STAGE_STYLE.lead
          const pct = totalRevenue > 0 ? Math.round((stage.revenue / totalRevenue) * 100) : 0

          return (
            <div
              key={stage.stage_code}
              className="flex-1 px-4 py-4 first:pl-5 last:pr-5"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                <span className={`text-[11px] font-medium ${style.text}`}>{stage.label}</span>
                <span className="ml-auto text-[11px] tabular-nums font-semibold text-[var(--color-text-strong)]">
                  {stage.count}
                </span>
              </div>
              <div className="text-[13px] tabular-nums font-semibold text-[var(--color-text-strong)]">
                {formatWan(stage.revenue)}
              </div>
              {stage.revenue > 0 && (
                <div className="mt-1.5 h-1 rounded-full bg-[rgba(148,163,184,0.08)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: style.dot.replace('bg-', '') }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Filter Select ──────────────────────────────────────────────────────────

interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

function FilterSelect({ value, onChange, options }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer rounded-xl border border-[var(--color-border)] bg-white/80 pl-3 pr-7 py-1.5 text-xs font-medium text-[var(--color-text-strong)] shadow-[var(--shadow-xs)] outline-none transition-all duration-160 hover:border-[rgba(37,99,235,0.18)] hover:bg-white/96 focus:border-[rgba(37,99,235,0.4)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
      />
    </div>
  )
}

// ─── Stage Badge ─────────────────────────────────────────────────────────────

function StageBadge({ stageCode, stageLabel }: { stageCode: string; stageLabel: string }) {
  const style = STAGE_STYLE[stageCode] ?? STAGE_STYLE.lead
  const Icon = style.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
      <Icon size={11} />
      {stageLabel}
    </span>
  )
}

// ─── Desktop Table ───────────────────────────────────────────────────────────

interface TableProps {
  rows: OpportunityLedger[]
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSort: (col: string) => void
  sortCol: string
  sortDir: 'asc' | 'desc'
}

function DesktopTable({ rows, expandedIds, onToggle, onSort, sortCol, sortDir }: TableProps) {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[rgba(15,23,42,0.03)]">
            {[
              { id: 'project_group', label: '项目分组', sortable: false, align: 'text-left' },
              { id: 'project_name', label: '项目名称', sortable: false, align: 'text-left' },
              { id: 'stage', label: '推进阶段', sortable: false, align: 'text-left' },
              { id: 'progress_note', label: '进度说明', sortable: false, align: 'text-left' },
              { id: 'target_date', label: '预计完成时间', sortable: true, align: 'text-left' },
              { id: 'first_year_revenue', label: '预期首年营收额', sortable: true, align: 'text-right' },
            ].map((col) => (
              <th
                key={col.id}
                onClick={col.sortable ? () => onSort(col.id) : undefined}
                className={`${col.align} border-b border-[var(--color-border)] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--color-text-strong)]' : ''}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    sortCol === col.id ? (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ChevronDown size={12} className="opacity-25" />
                    )
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExpanded = expandedIds.has(row.id)
            return (
              <>
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-[rgba(148,163,184,0.10)] transition-colors duration-160 hover:bg-[rgba(37,99,235,0.03)]"
                  onClick={() => onToggle(row.id)}
                >
                  <td className="px-3 py-3">
                    <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                      {row.project_group ?? '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="max-w-[260px]">
                      <div className="text-xs font-medium text-[var(--color-text-strong)] line-clamp-2">
                        {row.project_name}
                      </div>
                      {!isExpanded && row.progress_note && (
                        <div className="mt-1 text-[11px] text-[var(--color-text-muted)] line-clamp-1">
                          {row.progress_note.slice(0, 40)}{row.progress_note && row.progress_note.length > 40 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StageBadge stageCode={row.stage_code} stageLabel={row.stage_label} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="max-w-[300px] text-xs text-[var(--color-text-muted)] line-clamp-2">
                      {row.progress_note ?? '-'}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDate(row.target_date)}</span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <span className="text-xs font-semibold tabular-nums text-[var(--color-text-strong)]">
                      {row.first_year_revenue != null ? `${row.first_year_revenue}万/年` : '-'}
                    </span>
                  </td>
                </tr>
                {isExpanded && row.progress_note && (
                  <tr key={`${row.id}-expanded`} className="border-b border-[rgba(148,163,184,0.10)] bg-[rgba(15,23,42,0.02)]">
                    <td colSpan={6} className="px-6 py-3">
                      <div className="rounded-xl border border-[rgba(148,163,184,0.08)] bg-white/60 p-4">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Circle size={10} className="text-[var(--color-accent-hover)]" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">推进进度</span>
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--color-text-strong)] whitespace-pre-line">
                          {row.progress_note}
                        </p>
                        {row.first_year_revenue_raw && (
                          <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                            原始值：{row.first_year_revenue_raw}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Mobile Cards ────────────────────────────────────────────────────────────

interface MobileCardsProps {
  rows: OpportunityLedger[]
  expandedId: string | null
  onToggle: (id: string) => void
}

function MobileCards({ rows, expandedId, onToggle }: MobileCardsProps) {
  return (
    <div className="lg:hidden space-y-2 px-4 py-3">
      {rows.map((row) => {
        const isOpen = expandedId === row.id
        return (
          <div
            key={row.id}
            className="rounded-xl border border-[rgba(148,163,184,0.10)] bg-white/90 p-4 transition-all duration-160"
          >
            <div className="flex items-start justify-between gap-2" onClick={() => onToggle(row.id)}>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-xs font-semibold text-[var(--color-text-strong)] leading-snug">
                  {row.project_name}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {row.project_group && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">{row.project_group}</span>
                  )}
                  <span className="text-[10px] text-[var(--color-text-muted)]">{formatDate(row.target_date)}</span>
                  {row.first_year_revenue != null && (
                    <span className="text-[11px] font-semibold text-[var(--color-text-strong)]">{row.first_year_revenue}万/年</span>
                  )}
                </div>
              </div>
              <StageBadge stageCode={row.stage_code} stageLabel={row.stage_label} />
            </div>

            <div
              className="mt-2 flex cursor-pointer items-center justify-between"
              onClick={() => onToggle(row.id)}
            >
              <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1 flex-1 pr-2">
                {row.progress_note ?? '暂无进度说明'}
              </span>
              <span className="shrink-0 text-[10px] text-[var(--color-accent-hover)]">
                {isOpen ? '收起' : '展开'}
              </span>
            </div>

            {isOpen && row.progress_note && (
              <div className="mt-3 border-t border-[rgba(148,163,184,0.08)] pt-3">
                <div className="rounded-lg bg-[rgba(15,23,42,0.03)] p-3">
                  <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line">
                    {row.progress_note}
                  </p>
                  {row.first_year_revenue_raw && (
                    <div className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                      原始值：{row.first_year_revenue_raw}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color = 'default' }: {
  label: string
  value: string | number
  unit?: string
  color?: 'default' | 'success' | 'warning'
}) {
  const accentMap = {
    default: 'bg-[rgba(37,99,235,0.08)] text-[var(--color-accent-hover)]',
    success: 'bg-[rgba(15,159,110,0.10)] text-[#08724d]',
    warning: 'bg-[rgba(217,119,6,0.10)] text-[#a55406]',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/90 px-4 py-3 shadow-[var(--shadow-xs)]">
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(37,99,235,0.20)] to-transparent" />
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {label}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold text-[var(--color-text-strong)]">{value}</span>
            {unit && <span className="text-xs text-[var(--color-text-muted)]">{unit}</span>}
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${accentMap[color]}`}>
          Live
        </span>
      </div>
    </div>
  )
}

// ─── Pagination ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onChange: (p: number) => void
}

function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Build page number array with ellipsis
  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex items-center justify-between border-t border-[rgba(148,163,184,0.10)] px-4 py-2.5">
      <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
        {from}–{to} / 共 <span className="font-semibold text-[var(--color-text-strong)]">{total}</span> 条
      </span>
      <div className="flex items-center gap-0.5">
        <PagBtn icon={ChevronsLeft} onClick={() => onChange(1)} disabled={page === 1} label="首页" />
        <PagBtn icon={ChevronLeft} onClick={() => onChange(page - 1)} disabled={page === 1} label="上一页" />
        <div className="flex items-center gap-0.5 mx-1">
          {pageNumbers().map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="w-6 text-center text-xs text-[var(--color-text-muted)] select-none">…</span>
            ) : (
              <button
                key={n}
                onClick={() => onChange(n as number)}
                className={`min-w-[26px] rounded-lg px-1.5 py-1 text-xs font-medium transition-colors duration-120 ${
                  n === page
                    ? 'bg-[rgba(37,99,235,0.10)] text-[var(--color-accent-hover)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)]'
                }`}
              >
                {n}
              </button>
            )
          )}
        </div>
        <PagBtn icon={ChevronRight} onClick={() => onChange(page + 1)} disabled={page === totalPages} label="下一页" />
        <PagBtn icon={ChevronsRight} onClick={() => onChange(totalPages)} disabled={page === totalPages} label="末页" />
      </div>
    </div>
  )
}

function PagBtn({
  icon: Icon,
  onClick,
  disabled,
  label,
}: {
  icon: React.ElementType
  onClick: () => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-1 text-[var(--color-text-muted)] transition-colors duration-120 hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon size={14} />
    </button>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function OpportunityPage() {
  const { allData, loading } = useOpportunityData()

  // Filters
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [searchText, setSearchText] = useState('')

  // UI state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState('first_year_revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  // Derived: group & stage filter options
  const groupOptions = useMemo(() => {
    const groups = [...new Set(allData.map((r) => r.project_group).filter(Boolean))] as string[]
    return [{ value: 'all', label: '全部分组' }, ...groups.map((g) => ({ value: g, label: g }))]
  }, [allData])

  const stageOptions = [
    { value: 'all', label: '全部阶段' },
    ...STAGE_ORDER.map((code) => ({
      value: code,
      label: STAGE_LABEL[code] ?? code,
    })),
  ]

  // Filtered & sorted data
  const filtered = useMemo(() => {
    let rows = allData.filter((r) => {
      if (filterGroup !== 'all' && r.project_group !== filterGroup) return false
      if (filterStage !== 'all' && r.stage_code !== filterStage) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        return (
          r.project_name.toLowerCase().includes(q) ||
          r.project_group?.toLowerCase().includes(q) ||
          r.progress_note?.toLowerCase().includes(q) ||
          r.stage_label?.toLowerCase().includes(q)
        )
      }
      return true
    })

    rows = [...rows].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortCol === 'first_year_revenue') {
        va = a.first_year_revenue ?? 0
        vb = b.first_year_revenue ?? 0
      } else if (sortCol === 'target_date') {
        va = a.target_date ?? ''
        vb = b.target_date ?? ''
      } else if (sortCol === 'stage_order') {
        va = STAGE_ORDER.indexOf(a.stage_code)
        vb = STAGE_ORDER.indexOf(b.stage_code)
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [allData, filterGroup, filterStage, searchText, sortCol, sortDir])

  // Reset to page 1 whenever filters or sort change
  useEffect(() => { setPage(1) }, [filterGroup, filterStage, searchText, sortCol, sortDir])

  // Paginated slice
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length
    const totalRevenue = filtered.reduce((s, r) => s + (r.first_year_revenue ?? 0), 0)
    const contractedRevenue = filtered
      .filter((r) => r.stage_code === 'contracted')
      .reduce((s, r) => s + (r.first_year_revenue ?? 0), 0)
    return { total, totalRevenue, contractedRevenue }
  }, [filtered])

  // Funnel stages
  const funnelStages = useMemo((): StageStat[] => {
    return STAGE_ORDER.map((code) => {
      const rows = filtered.filter((r) => r.stage_code === code)
      return {
        stage_code: code,
        label: STAGE_LABEL[code] ?? code,
        count: rows.length,
        revenue: rows.reduce((s, r) => s + (r.first_year_revenue ?? 0), 0),
      }
    })
  }, [filtered])

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hasActiveFilter = filterGroup !== 'all' || filterStage !== 'all' || searchText !== ''

  return (
    <div className="app-page">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="项目总数" value={stats.total} unit="项" color="default" />
        <StatCard label="签约预期营收" value={formatWan(stats.contractedRevenue)} color="success" />
        <StatCard label="全部商机营收" value={formatWan(stats.totalRevenue)} color="warning" />
      </div>

      {/* Funnel pipeline bar */}
      <FunnelBar stages={funnelStages} totalRevenue={stats.totalRevenue} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <FilterSelect
          value={filterGroup}
          onChange={setFilterGroup}
          options={groupOptions}
        />
        <FilterSelect
          value={filterStage}
          onChange={setFilterStage}
          options={stageOptions}
        />

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="搜索项目名称..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-white/80 pl-8 pr-3 py-1.5 text-xs text-[var(--color-text-strong)] placeholder:text-[var(--color-text-muted)] shadow-[var(--shadow-xs)] outline-none transition-all duration-160 hover:border-[rgba(37,99,235,0.18)] focus:border-[rgba(37,99,235,0.4)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {hasActiveFilter && (
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/60 px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)] transition-all duration-160 hover:border-[rgba(37,99,235,0.18)] hover:text-[var(--color-text-strong)]"
            onClick={() => {
              setFilterGroup('all')
              setFilterStage('all')
              setSearchText('')
            }}
          >
            <X size={11} />
            清除筛选
          </button>
        )}

        <span className="ml-auto text-[11px] font-medium tabular-nums text-[var(--color-text-muted)]">
          共 {filtered.length} 条
        </span>
      </div>

      {/* Data table */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white/90 shadow-[var(--shadow-xs)]">
        {loading ? (
          <AppLoading label="加载商机数据..." variant="block" />
        ) : filtered.length === 0 ? (
          <div className="app-empty-state">暂无数据</div>
        ) : (
          <>
            <DesktopTable
              rows={paginated}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
              onSort={handleSort}
              sortCol={sortCol}
              sortDir={sortDir}
            />
            <MobileCards
              rows={paginated}
              expandedId={expandedMobile}
              onToggle={setExpandedMobile}
            />
            <Pagination
              page={page}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
