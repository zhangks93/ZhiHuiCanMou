import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Search,
  X,
  CheckCircle2,
  Building2,
  Clock3,
  type LucideIcon,
} from 'lucide-react'
import { AppLoading } from '@/shared/ui/AppLoading'
import { AppPagination } from '@/shared/ui/AppPagination'
import { useOpportunityData } from '../hooks/useOpportunityData'
import type { OpportunityLedger } from '../types'

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

const STAGE_STYLE: Record<StageCode, { bg: string; text: string; dot: string; barColor: string; icon: LucideIcon }> = {
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

function formatDate(value: string | null): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

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
        className="app-filter-control app-filter-select min-w-[104px]"
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

interface TableProps {
  rows: OpportunityLedger[]
  onSort: (col: string) => void
  sortCol: string
  sortDir: 'asc' | 'desc'
}

function DesktopTable({ rows, onSort, sortCol, sortDir }: TableProps) {
  const columns = [
    { id: 'project_group', label: '项目分组', sortable: false, align: 'text-left', width: '13%' },
    { id: 'project_name', label: '项目名称', sortable: false, align: 'text-left', width: '27%' },
    { id: 'stage', label: '推进阶段', sortable: false, align: 'text-left', width: '14%' },
    { id: 'progress_note', label: '进度说明', sortable: false, align: 'text-left', width: '26%' },
    { id: 'target_date', label: '预计完成时间', sortable: true, align: 'text-left', width: '10%' },
    { id: 'first_year_revenue', label: '预期首年营收额', sortable: true, align: 'text-right', width: '10%' },
  ] as const

  return (
    <div className="app-table-scroll hidden lg:block">
      <table className="app-data-table">
        <colgroup>
          {columns.map((col) => (
            <col key={col.id} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col) => (
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
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="app-cell-muted whitespace-nowrap">
                  {row.project_group ?? '-'}
                </span>
              </td>
              <td>
                <div className="max-w-[320px]">
                  <div className="app-cell-strong line-clamp-2 font-medium leading-snug">
                    {row.project_name}
                  </div>
                </div>
              </td>
              <td>
                <StageBadge stageCode={row.stage_code} stageLabel={row.stage_label} />
              </td>
              <td>
                <div className="app-cell-muted max-w-[360px] line-clamp-2 leading-relaxed">
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
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MobileCards({ rows }: { rows: OpportunityLedger[] }) {
  return (
    <div className="lg:hidden space-y-2 px-4 py-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-xl border border-[rgba(148,163,184,0.10)] bg-white/90 p-4 transition-all duration-160"
        >
          <div className="flex items-start justify-between gap-2">
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

          <div className="mt-3 rounded-lg bg-[rgba(15,23,42,0.03)] p-3">
            <p className="text-caption leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line">
              {row.progress_note ?? '暂无进度说明'}
            </p>
            {row.first_year_revenue_raw && (
              <div className="mt-2 text-caption text-[var(--color-text-muted)]">
                原始值：{row.first_year_revenue_raw}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const PAGE_SIZE = 10

export function OpportunityPage() {
  const { allData, loading } = useOpportunityData()

  const [filterGroup, setFilterGroup] = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [sortCol, setSortCol] = useState('first_year_revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const updateFilterGroup = (value: string) => {
    setFilterGroup(value)
    setPage(1)
  }

  const updateFilterStage = (value: string) => {
    setFilterStage(value)
    setPage(1)
  }

  const updateSearchText = (value: string) => {
    setSearchText(value)
    setPage(1)
  }

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
    setPage(1)
  }

  const hasActiveFilter = filterGroup !== 'all' || filterStage !== 'all' || searchText !== ''

  return (
    <div className="app-page">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={filterGroup}
          onChange={updateFilterGroup}
          options={groupOptions}
        />
        <FilterSelect
          value={filterStage}
          onChange={updateFilterStage}
          options={stageOptions}
        />

        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-accent)]"
          />
          <input
            type="text"
            placeholder="搜索项目名称..."
            value={searchText}
            onChange={(e) => updateSearchText(e.target.value)}
            className="app-filter-control app-filter-search-input"
          />
          {searchText && (
            <button
              onClick={() => updateSearchText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {hasActiveFilter && (
          <button
            className="app-filter-control app-filter-action"
            onClick={() => {
              updateFilterGroup('all')
              updateFilterStage('all')
              updateSearchText('')
            }}
          >
            <X size={11} />
            清除筛选
          </button>
        )}
      </div>

      <div className="app-table-shell">
        {loading ? (
          <AppLoading label="加载商机数据..." variant="block" />
        ) : filtered.length === 0 ? (
          <div className="app-empty-state">暂无数据</div>
        ) : (
          <>
            <DesktopTable
              rows={paginated}
              onSort={handleSort}
              sortCol={sortCol}
              sortDir={sortDir}
            />
            <MobileCards rows={paginated} />
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
