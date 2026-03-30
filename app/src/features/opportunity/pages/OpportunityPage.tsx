import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Search,
  X,
  CheckCircle2,
  Building2,
  Clock3,
} from 'lucide-react'
import { AppLoading } from '@/shared/ui/AppLoading'
import { AppPagination } from '@/shared/ui/AppPagination'
import { useOpportunityData } from '../hooks/useOpportunityData'
import type { OpportunityLedger } from '../types'

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

const STAGE_STYLE: Record<StageCode, { bg: string; text: string; dot: string; barColor: string; icon: typeof Circle }> = {
  lead: {
    bg: 'bg-[rgba(148,163,184,0.08)]',
    text: 'text-[#64748b]',
    dot: 'bg-[#94a3b8]',
    barColor: '#94a3b8',
    icon: Search,
  },
  opportunity: {
    bg: 'bg-[rgba(34,197,94,0.08)]',
    text: 'text-[var(--color-accent-hover)]',
    dot: 'bg-[var(--color-accent-hover)]',
    barColor: 'var(--color-accent-hover)',
    icon: Clock3,
  },
  internal_approval: {
    bg: 'bg-[rgba(217,119,6,0.10)]',
    text: 'text-[#a55406]',
    dot: 'bg-[#d97706]',
    barColor: '#d97706',
    icon: Building2,
  },
  customer_approval: {
    bg: 'bg-[rgba(168,85,247,0.08)]',
    text: 'text-[#7c3aed]',
    dot: 'bg-[#a855f7]',
    barColor: '#a855f7',
    icon: Clock3,
  },
  contracted: {
    bg: 'bg-[rgba(15,159,110,0.10)]',
    text: 'text-[#08724d]',
    dot: 'bg-[#10b981]',
    barColor: '#10b981',
    icon: CheckCircle2,
  },
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

// ─── Funnel Stage Bar ────────────────────────────────────────────────────────

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
        className="appearance-none cursor-pointer rounded-xl border border-[var(--color-border)] bg-white/80 pl-3 pr-7 py-1.5 text-caption font-medium text-[var(--color-text-strong)] shadow-[var(--shadow-xs)] outline-none transition-all duration-160 hover:border-[rgba(95,127,188,0.18)] hover:bg-white/96 focus:border-[rgba(95,127,188,0.40)] focus:shadow-[0_0_0_3px_rgba(95,127,188,0.08)]"
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
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-caption font-semibold ${style.bg} ${style.text}`}>
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
    <div className="app-table-scroll hidden lg:block">
      <table className="app-data-table">
        <thead>
          <tr>
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
                className={`${col.align} ${col.sortable ? 'is-sortable' : ''}`}
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
            return [
              (
                <tr
                  key={row.id}
                  className="app-data-row-interactive"
                  onClick={() => onToggle(row.id)}
                >
                  <td>
                    <span className="app-cell-muted whitespace-nowrap">
                      {row.project_group ?? '-'}
                    </span>
                  </td>
                  <td>
                    <div className="max-w-[260px]">
                      <div className="app-cell-strong line-clamp-2 font-medium">
                        {row.project_name}
                      </div>
                      {!isExpanded && row.progress_note && (
                        <div className="app-cell-muted mt-1 line-clamp-1">
                          {row.progress_note.slice(0, 40)}{row.progress_note && row.progress_note.length > 40 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <StageBadge stageCode={row.stage_code} stageLabel={row.stage_label} />
                  </td>
                  <td>
                    <div className="app-cell-muted max-w-[300px] line-clamp-2">
                      {row.progress_note ?? '-'}
                    </div>
                  </td>
                  <td>
                    <span className="app-cell-muted app-cell-numeric whitespace-nowrap">{formatDate(row.target_date)}</span>
                  </td>
                  <td className="text-right">
                    <span className="app-cell-strong app-cell-numeric whitespace-nowrap font-semibold">
                      {row.first_year_revenue != null ? `${row.first_year_revenue}万/年` : '-'}
                    </span>
                  </td>
                </tr>
              ),
              isExpanded && row.progress_note ? (
                <tr key={`${row.id}-expanded`} className="app-data-row-emphasis app-data-row-static">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="rounded-xl border border-[rgba(148,163,184,0.08)] bg-white/60 p-4">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Circle size={10} className="text-[var(--color-accent-hover)]" />
                          <span className="text-caption font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">推进进度</span>
                        </div>
                        <p className="text-body leading-relaxed text-[var(--color-text-strong)] whitespace-pre-line">
                          {row.progress_note}
                        </p>
                        {row.first_year_revenue_raw && (
                          <div className="mt-2 text-body text-[var(--color-text-muted)]">
                            原始值：{row.first_year_revenue_raw}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
              ) : null,
            ]
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
                <div className="line-clamp-2 text-caption font-semibold text-[var(--color-text-strong)] leading-snug">
                  {row.project_name}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {row.project_group && (
                    <span className="text-caption text-[var(--color-text-muted)]">{row.project_group}</span>
                  )}
                  <span className="text-caption text-[var(--color-text-muted)]">{formatDate(row.target_date)}</span>
                  {row.first_year_revenue != null && (
                    <span className="text-caption font-semibold text-[var(--color-text-strong)]">{row.first_year_revenue}万/年</span>
                  )}
                </div>
              </div>
              <StageBadge stageCode={row.stage_code} stageLabel={row.stage_label} />
            </div>

            <div
              className="mt-2 flex cursor-pointer items-center justify-between"
              onClick={() => onToggle(row.id)}
            >
              <span className="text-caption text-[var(--color-text-muted)] line-clamp-1 flex-1 pr-2">
                {row.progress_note ?? '暂无进度说明'}
              </span>
              <span className="shrink-0 text-caption text-[var(--color-accent-hover)]">
                {isOpen ? '收起' : '展开'}
              </span>
            </div>

            {isOpen && row.progress_note && (
              <div className="mt-3 border-t border-[rgba(148,163,184,0.08)] pt-3">
                <div className="rounded-lg bg-[rgba(15,23,42,0.03)] p-3">
                  <p className="text-caption leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line">
                    {row.progress_note}
                  </p>
                  {row.first_year_revenue_raw && (
                    <div className="mt-2 text-caption text-[var(--color-text-muted)]">
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

// ─── Pagination ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

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

      {/* Filter bar */}
      <section className="app-section-card app-section-card-muted p-4">
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
            className="w-full rounded-xl border border-[var(--color-border)] bg-white/80 pl-8 pr-3 py-1.5 text-caption text-[var(--color-text-strong)] placeholder:text-[var(--color-text-muted)] shadow-[var(--shadow-xs)] outline-none transition-all duration-160 hover:border-[rgba(95,127,188,0.18)] focus:border-[rgba(95,127,188,0.40)] focus:shadow-[0_0_0_3px_rgba(95,127,188,0.08)]"
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
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/60 px-2.5 py-1.5 text-caption font-medium text-[var(--color-text-muted)] transition-all duration-160 hover:border-[rgba(95,127,188,0.18)] hover:text-[var(--color-text-strong)]"
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

        <span className="ml-auto text-caption font-medium tabular-nums text-[var(--color-text-muted)]">
          共 {filtered.length} 条
        </span>
        </div>
      </section>

      {/* Data table */}
      <div className="app-table-shell">
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
            <AppPagination
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
