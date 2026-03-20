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
  Loader2,
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
  tracking: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Circle },
  bidding: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  contracted: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  operating: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
  suspended: { bg: 'bg-orange-50', text: 'text-orange-700', icon: AlertTriangle },
  lost: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
}

const TYPE_STYLE: Record<string, string> = {
  operation: 'bg-primary/10 text-primary',
  expansion: 'bg-accent/10 text-accent',
  tracking: 'bg-gray-100 text-gray-600',
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
      className={`inline-block w-2.5 h-2.5 rounded-full ${approved ? 'bg-green-500' : 'bg-gray-300'}`}
      title={title}
    />
  )
}

function ProbBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-400">-</span>
  const pct = Math.round(value * 100)
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="inline-flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
    </div>
  )
}

function ProbText({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-400">-</span>
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'
  return <span className={`text-sm font-medium ${color}`}>{pct}%</span>
}

// --- TanStack 列定义 (合并审批列: 10→8) ---

const columnHelper = createColumnHelper<OpportunityLedger>()

const columns = [
  columnHelper.accessor('item_type', {
    header: '项目类型',
    enableSorting: false,
    cell: (info) => (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLE[info.getValue()] ?? ''}`}>
        {ITEM_TYPE_LABEL[info.getValue()] ?? info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('region', {
    header: '区域',
    enableSorting: false,
    cell: (info) => <span className="text-gray-600 whitespace-nowrap">{info.getValue() ?? '-'}</span>,
  }),
  columnHelper.accessor('project_name', {
    header: '项目名称',
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-gray-900 max-w-[220px] truncate" title={row.original.project_name}>
          {row.original.project_name}
        </div>
        {row.getIsExpanded() && row.original.remark && (
          <div className="mt-2 text-xs text-gray-500 leading-relaxed whitespace-pre-line bg-gray-50 rounded p-2">
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
      <span className="font-medium text-gray-900 whitespace-nowrap tabular-nums">{formatAmount(info.getValue())}</span>
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
    cell: (info) => <span className="text-gray-600 whitespace-nowrap">{formatDate(info.getValue())}</span>,
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
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
          <Icon size={12} />
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
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-200">
              {headerGroup.headers.map((header) => {
                const align = getAlignClass(header.column.id)
                const canSort = header.column.getCanSort()
                return (
                  <th
                    key={header.id}
                    className={`${align} py-2.5 px-3 text-xs text-gray-500 uppercase tracking-wide font-medium whitespace-nowrap ${canSort ? 'cursor-pointer select-none hover:text-gray-900' : ''} ${header.column.id === 'project_name' ? 'min-w-[200px]' : ''}`}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className={canSort ? 'inline-flex items-center gap-1' : ''}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        header.column.getIsSorted() === 'asc'
                          ? <ChevronUp size={14} />
                          : header.column.getIsSorted() === 'desc'
                            ? <ChevronDown size={14} />
                            : <ChevronDown size={14} className="opacity-30" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-gray-50/60 transition-colors cursor-pointer"
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
    <div className="lg:hidden divide-y divide-gray-100">
      {table.getRowModel().rows.map((row) => {
        const d = row.original
        const isOpen = expandedId === row.id
        const statusVal = d.status ?? 'tracking'
        const style = STATUS_STYLE[statusVal] ?? STATUS_STYLE.tracking
        const Icon = style.icon

        return (
          <div
            key={row.id}
            className="px-4 py-3 cursor-pointer active:bg-gray-50 transition-colors"
            onClick={() => setExpandedId(isOpen ? null : row.id)}
          >
            {/* 第一行：项目名 + 状态 */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
                {d.project_name}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${style.bg} ${style.text}`}>
                <Icon size={12} />
                {STATUS_LABEL[statusVal] ?? statusVal}
              </span>
            </div>

            {/* 第二行：金额 + 概率 */}
            <div className="flex items-center gap-4 mt-1.5">
              <span className="text-sm font-medium text-gray-900 tabular-nums">
                {formatAmount(d.estimated_amount)}
              </span>
              <ProbText value={d.win_probability} />
            </div>

            {/* 第三行：类型 + 区域标签 */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLE[d.item_type] ?? ''}`}>
                {ITEM_TYPE_LABEL[d.item_type] ?? d.item_type}
              </span>
              {d.region && (
                <span className="text-xs text-gray-500">{d.region}</span>
              )}
            </div>

            {/* 展开详情 */}
            {isOpen && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">投标日期</span>
                  <span className="text-gray-700">{formatDate(d.bid_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">审批状态</span>
                  <div className="inline-flex items-center gap-2">
                    <ApprovalDot approved={d.logistics_approved} label="后勤投决" />
                    <ApprovalDot approved={d.group_approved} label="集团投决" />
                    <ApprovalDot approved={d.manager_ready} label="项目经理就绪" />
                  </div>
                </div>
                {d.remark && (
                  <div className="text-xs text-gray-500 leading-relaxed whitespace-pre-line bg-gray-50 rounded p-2">
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
  return (
    <>
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="项目总数" value={stats.total} unit="个" />
        <StatCard label="预估总额" value={formatAmount(stats.totalAmount)} color="default" />
        <StatCard label="加权金额" value={formatAmount(stats.weightedAmount)} color="warning" />
        <StatCard label="平均概率" value={`${Math.round(stats.avgProb * 100)}%`} color={stats.avgProb >= 0.5 ? 'success' : 'error'} />
      </div>

      {/* 筛选栏 */}
      <div className="bg-surface rounded-lg border border-gray-200 p-4 mb-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-gray-500" />

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="select select-sm select-bordered">
            <option value="all">全部类型</option>
            {Object.entries(ITEM_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="select select-sm select-bordered">
            <option value="all">全部区域</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select select-sm select-bordered">
            <option value="pipeline">跟进中(默认)</option>
            <option value="all">全部</option>
            <option value="tracking">跟踪中</option>
            <option value="bidding">投标中</option>
            <option value="contracted">已签约</option>
            <option value="operating">运营中</option>
            <option value="suspended">暂停</option>
            <option value="lost">已丢失</option>
          </select>

          {!isDefaultFilter && (
            <button
              className="btn btn-ghost btn-sm text-gray-500"
              onClick={() => { setFilterType('all'); setFilterRegion('all'); setFilterStatus('pipeline') }}
            >
              清除筛选
            </button>
          )}

          <span className="ml-auto text-sm text-gray-500">
            共 {filtered.length} 条
          </span>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-surface rounded-lg border border-gray-200 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">暂无数据</div>
        ) : (
          <>
            <DesktopTable table={table} />
            <MobileCards table={table} />
          </>
        )}
      </div>

      {/* 分页 */}
      {!loading && table.getPageCount() > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-600">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft size={16} />
            <span className="hidden lg:inline">上一页</span>
          </button>
          <span>
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="hidden lg:inline">下一页</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  )
}
