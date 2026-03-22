import { useState, useEffect, useCallback, useMemo } from 'react'
import { StatCard } from '@/components/ui/StatCard'
import {
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react'
import { supabase, type OpportunityLedger } from '@/lib/supabase'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ExpandedState,
  type Table,
} from '@tanstack/react-table'

// --- 常量映射 ---

const ITEM_TYPE_LABEL: Record<string, string> = {
  operation: '运营项目',
  expansion: '拓展项目',
  tracking: '跟踪项目',
}

const STATUS_LABEL: Record<string, string> = {
  tracking: '跟踪中',
  bidding: '投标中',
  contracted: '已签约',
  operating: '运营中',
  suspended: '暂停',
  lost: '已丢失',
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: typeof Circle }> = {
  tracking: { bg: 'bg-[rgba(37,99,235,0.08)]', text: 'text-[var(--color-accent-hover)]', icon: Circle },
  bidding: { bg: 'bg-[rgba(217,119,6,0.10)]', text: 'text-[#a55406]', icon: Clock },
  contracted: { bg: 'bg-[rgba(15,159,110,0.10)]', text: 'text-[#08724d]', icon: CheckCircle2 },
  operating: { bg: 'bg-[rgba(15,159,110,0.12)]', text: 'text-[#08724d]', icon: CheckCircle2 },
  suspended: { bg: 'bg-[rgba(217,119,6,0.10)]', text: 'text-[#a55406]', icon: AlertTriangle },
  lost: { bg: 'bg-[rgba(220,38,38,0.08)]', text: 'text-[#b42318]', icon: XCircle },
}

const TYPE_STYLE: Record<string, string> = {
  operation: 'bg-[rgba(37,99,235,0.08)] text-[var(--color-accent-hover)]',
  expansion: 'bg-[rgba(15,159,110,0.10)] text-[#08724d]',
  tracking: 'bg-[rgba(15,23,42,0.05)] text-[var(--color-text-muted)]',
}

const STATUS_ORDER = ['operating', 'contracted', 'bidding', 'tracking', 'suspended', 'lost']

function formatAmount(v: number | null): string {
  if (v == null) return '-'
  return `${v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}万`
}

function formatDate(v: string | null): string {
  if (!v) return '-'
  return v.slice(0, 10)
}

// --- 小组件 ---

function ApprovalDot({ approved, label }: { approved: boolean; label?: string }) {
  const title = label ? `${label}：${approved ? '已通过' : '未通过'}` : (approved ? '已通过' : '未通过')
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${approved ? 'bg-[#0f9f6e]' : 'bg-[rgba(148,163,184,0.35)]'}`}
      title={title}
    />
  )
}

function ProbBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--color-text-muted)]">-</span>
  const pct = Math.round(value * 100)
  const color =
    pct >= 80 ? 'bg-[#0f9f6e]' : pct >= 50 ? 'bg-[#d97706]' : 'bg-[#dc2626]'
  return (
    <div className="inline-flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1 bg-[rgba(15,23,42,0.06)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-[var(--color-text-muted)] w-8 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

function ProbText({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--color-text-muted)]">-</span>
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'text-[#08724d]' : pct >= 50 ? 'text-[#a55406]' : 'text-[#b42318]'
  return <span className={`text-xs font-semibold ${color}`}>{pct}%</span>
}

// --- 自定义选择器 ---

interface AppSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

function AppSelect({ value, onChange, options }: AppSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer rounded-xl border border-[var(--color-border)] bg-white/80 backdrop-blur-sm pl-3 pr-7 py-1.5 text-xs font-medium text-[var(--color-text-strong)] shadow-[var(--shadow-xs)] outline-none transition-all duration-160 hover:border-[rgba(37,99,235,0.18)] hover:bg-white/96 focus:border-[rgba(37,99,235,0.4)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
    </div>
  )
}

// --- TanStack 列定义 ---

const columnHelper = createColumnHelper<OpportunityLedger>()

const columns = [
  columnHelper.accessor('item_type', {
    header: '项目类型',
    enableSorting: false,
    cell: (info) => (
      <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-semibold ${TYPE_STYLE[info.getValue()] ?? ''}`}>
        {ITEM_TYPE_LABEL[info.getValue()] ?? info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('region', {
    header: '区域',
    enableSorting: false,
    cell: (info) => <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{info.getValue() ?? '-'}</span>,
  }),
  columnHelper.accessor('project_name', {
    header: '项目名称',
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-xs text-[var(--color-text-strong)] max-w-[220px] truncate" title={row.original.project_name}>
          {row.original.project_name}
        </div>
        {row.getIsExpanded() && row.original.remark && (
          <div className="mt-2 text-[11px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line bg-[rgba(15,23,42,0.03)] rounded-lg p-2">
            {row.original.remark}
          </div>
        )}
      </div>
    ),
  }),
  columnHelper.accessor('estimated_amount', {
    header: '预估金额',
    enableSorting: true,
    cell: (info) => (
      <span className="font-semibold text-xs text-[var(--color-text-strong)] whitespace-nowrap tabular-nums">{formatAmount(info.getValue())}</span>
    ),
    sortingFn: (a, b) => (a.original.estimated_amount ?? 0) - (b.original.estimated_amount ?? 0),
  }),
  columnHelper.display({
    id: 'approval',
    header: '审批',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="inline-flex items-center gap-1.5">
        <ApprovalDot approved={row.original.logistics_approved} label="后勤投决" />
        <ApprovalDot approved={row.original.group_approved} label="集团投决" />
        <ApprovalDot approved={row.original.manager_ready} label="项目经理就绪" />
      </div>
    ),
  }),
  columnHelper.accessor('bid_date', {
    header: '投标日期',
    enableSorting: true,
    cell: (info) => <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{formatDate(info.getValue())}</span>,
    sortingFn: (a, b) => (a.original.bid_date ?? '').localeCompare(b.original.bid_date ?? ''),
  }),
  columnHelper.accessor('status', {
    header: '状态',
    enableSorting: true,
    cell: (info) => {
      const val = info.getValue() ?? 'tracking'
      const style = STATUS_STYLE[val] ?? STATUS_STYLE.tracking
      const Icon = style.icon
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${style.bg} ${style.text}`}>
          <Icon size={11} />
          {STATUS_LABEL[val] ?? val}
        </span>
      )
    },
    sortingFn: (a, b) =>
      STATUS_ORDER.indexOf(a.original.status ?? 'tracking') - STATUS_ORDER.indexOf(b.original.status ?? 'tracking'),
  }),
  columnHelper.accessor('win_probability', {
    header: '中标概率',
    enableSorting: true,
    cell: (info) => <ProbBar value={info.getValue()} />,
    sortingFn: (a, b) => (a.original.win_probability ?? 0) - (b.original.win_probability ?? 0),
  }),
]

// --- 列对齐映射 ---
const RIGHT_ALIGN_COLS = new Set(['estimated_amount', 'win_probability'])
const CENTER_ALIGN_COLS = new Set(['approval'])

function getAlignClass(colId: string) {
  if (RIGHT_ALIGN_COLS.has(colId)) return 'text-right'
  if (CENTER_ALIGN_COLS.has(colId)) return 'text-center'
  return 'text-left'
}

// --- 桌面端表格 ---

function DesktopTable({ table }: { table: Table<OpportunityLedger> }) {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-[rgba(15,23,42,0.03)]">
              {headerGroup.headers.map((header) => {
                const align = getAlignClass(header.column.id)
                const canSort = header.column.getCanSort()
                return (
                  <th
                    key={header.id}
                    className={`${align} py-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] whitespace-nowrap border-b border-[var(--color-border)] ${canSort ? 'cursor-pointer select-none hover:text-[var(--color-text-strong)]' : ''} ${header.column.id === 'project_name' ? 'min-w-[200px]' : ''}`}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className={canSort ? 'inline-flex items-center gap-1' : ''}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        header.column.getIsSorted() === 'asc'
                          ? <ChevronUp size={12} />
                          : header.column.getIsSorted() === 'desc'
                            ? <ChevronDown size={12} />
                            : <ChevronDown size={12} className="opacity-25" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-[rgba(37,99,235,0.03)] transition-colors duration-160 cursor-pointer border-b border-[rgba(148,163,184,0.10)]"
              onClick={() => row.toggleExpanded()}
            >
              {row.getVisibleCells().map((cell) => {
                const align = getAlignClass(cell.column.id)
                return (
                  <td key={cell.id} className={`${align} py-2.5 px-3`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- 移动端卡片 ---

function MobileCards({ table }: { table: Table<OpportunityLedger> }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="lg:hidden">
      {table.getRowModel().rows.map((row) => {
        const d = row.original
        const isOpen = expandedId === row.id
        const statusVal = d.status ?? 'tracking'
        const style = STATUS_STYLE[statusVal] ?? STATUS_STYLE.tracking
        const Icon = style.icon

        return (
          <div
            key={row.id}
            className="px-4 py-3 cursor-pointer active:bg-[rgba(37,99,235,0.03)] transition-colors border-b border-[rgba(148,163,184,0.08)]"
            onClick={() => setExpandedId(isOpen ? null : row.id)}
          >
            {/* 第一行：项目名 + 状态 */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-[var(--color-text-strong)] text-xs leading-snug line-clamp-2 flex-1">
                {d.project_name}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold shrink-0 ${style.bg} ${style.text}`}>
                <Icon size={11} />
                {STATUS_LABEL[statusVal] ?? statusVal}
              </span>
            </div>

            {/* 第二行：金额 + 概率 */}
            <div className="flex items-center gap-4 mt-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-strong)] tabular-nums">
                {formatAmount(d.estimated_amount)}
              </span>
              <ProbText value={d.win_probability} />
            </div>

            {/* 第三行：类型 + 区域标签 */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-semibold ${TYPE_STYLE[d.item_type] ?? ''}`}>
                {ITEM_TYPE_LABEL[d.item_type] ?? d.item_type}
              </span>
              {d.region && (
                <span className="text-[11px] text-[var(--color-text-muted)]">{d.region}</span>
              )}
            </div>

            {/* 展开详情 */}
            {isOpen && (
              <div className="mt-3 pt-3 border-t border-[rgba(148,163,184,0.12)] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">投标日期</span>
                  <span className="text-[var(--color-text-strong)]">{formatDate(d.bid_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">审批状态</span>
                  <div className="inline-flex items-center gap-2">
                    <ApprovalDot approved={d.logistics_approved} label="后勤投决" />
                    <ApprovalDot approved={d.group_approved} label="集团投决" />
                    <ApprovalDot approved={d.manager_ready} label="项目经理就绪" />
                  </div>
                </div>
                {d.remark && (
                  <div className="text-[11px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line bg-[rgba(15,23,42,0.03)] rounded-lg p-2">
                    {d.remark}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- 主组件 ---

export function Opportunity() {
  const [data, setData] = useState<OpportunityLedger[]>([])
  const [loading, setLoading] = useState(true)

  // 筛选
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('pipeline')

  // TanStack 状态
  const [sorting, setSorting] = useState<SortingState>([{ id: 'estimated_amount', desc: true }])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('opportunity_ledger')
      .select('*')
      .order('snapshot_date', { ascending: false })

    if (!error && rows) {
      const latest = rows[0]?.snapshot_date
      if (latest) {
        setData(rows.filter((r) => r.snapshot_date === latest) as OpportunityLedger[])
      } else {
        setData([])
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 提取可选区域
  const regions = useMemo(
    () => [...new Set(data.map((d) => d.region).filter(Boolean))] as string[],
    [data],
  )

  // 预筛选数据
  const filtered = useMemo(() => {
    let result = data
    if (filterType !== 'all') result = result.filter((d) => d.item_type === filterType)
    if (filterRegion !== 'all') result = result.filter((d) => d.region === filterRegion)
    if (filterStatus === 'pipeline') {
      result = result.filter((d) => d.status !== 'operating' && d.status !== 'contracted')
    } else if (filterStatus !== 'all') {
      result = result.filter((d) => d.status === filterStatus)
    }
    return result
  }, [data, filterType, filterRegion, filterStatus])

  // 统计
  const stats = useMemo(() => {
    const total = filtered.length
    const totalAmount = filtered.reduce((s, d) => s + (d.estimated_amount ?? 0), 0)
    const weightedAmount = filtered.reduce(
      (s, d) => s + (d.estimated_amount ?? 0) * (d.win_probability ?? 0), 0,
    )
    const avgProb = total > 0
      ? filtered.reduce((s, d) => s + (d.win_probability ?? 0), 0) / total
      : 0
    return { total, totalAmount, weightedAmount, avgProb }
  }, [filtered])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    initialState: { pagination: { pageSize: 15 } },
  })

  const isDefaultFilter = filterType === 'all' && filterRegion === 'all' && filterStatus === 'pipeline'

  const typeOptions = [
    { value: 'all', label: '全部类型' },
    ...Object.entries(ITEM_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v })),
  ]

  const regionOptions = [
    { value: 'all', label: '全部区域' },
    ...regions.map((r) => ({ value: r, label: r })),
  ]

  const statusOptions = [
    { value: 'pipeline', label: '跟进中(默认)' },
    { value: 'all', label: '全部' },
    { value: 'tracking', label: '跟踪中' },
    { value: 'bidding', label: '投标中' },
    { value: 'contracted', label: '已签约' },
    { value: 'operating', label: '运营中' },
    { value: 'suspended', label: '暂停' },
    { value: 'lost', label: '已丢失' },
  ]

  return (
    <div className="app-page">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="项目总数" value={stats.total} unit="个" />
        <StatCard label="预估总额" value={formatAmount(stats.totalAmount)} color="default" />
        <StatCard label="加权金额" value={formatAmount(stats.weightedAmount)} color="warning" />
        <StatCard label="平均概率" value={`${Math.round(stats.avgProb * 100)}%`} color={stats.avgProb >= 0.5 ? 'success' : 'error'} />
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Filter size={14} className="text-[var(--color-text-muted)]" />

        <AppSelect value={filterType} onChange={setFilterType} options={typeOptions} />
        <AppSelect value={filterRegion} onChange={setFilterRegion} options={regionOptions} />
        <AppSelect value={filterStatus} onChange={setFilterStatus} options={statusOptions} />

        {!isDefaultFilter && (
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/60 px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)] transition-all duration-160 hover:border-[rgba(37,99,235,0.18)] hover:text-[var(--color-text-strong)]"
            onClick={() => { setFilterType('all'); setFilterRegion('all'); setFilterStatus('pipeline') }}
          >
            <X size={11} />
            清除筛选
          </button>
        )}

        <span className="ml-auto text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums">
          共 {filtered.length} 条
        </span>
      </div>

      {/* 数据表格 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white/90 backdrop-blur-sm overflow-hidden shadow-[var(--shadow-xs)]">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--color-text-muted)]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] mx-auto mb-2.5" />
              <div className="text-[11px]">加载中…</div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="app-empty-state">暂无数据</div>
        ) : (
          <>
            <DesktopTable table={table} />
            <MobileCards table={table} />
          </>
        )}
      </div>

      {/* 分页 */}
      {!loading && table.getPageCount() > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/80 px-3 py-1.5 text-[var(--color-text-muted)] transition-all duration-160 hover:border-[rgba(37,99,235,0.18)] hover:text-[var(--color-text-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft size={14} />
            <span className="hidden lg:inline">上一页</span>
          </button>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums">
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
          </span>
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/80 px-3 py-1.5 text-[var(--color-text-muted)] transition-all duration-160 hover:border-[rgba(37,99,235,0.18)] hover:text-[var(--color-text-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="hidden lg:inline">下一页</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
