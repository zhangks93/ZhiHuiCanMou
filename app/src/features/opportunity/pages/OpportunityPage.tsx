import { useMemo, useState } from 'react'
import {
  CalendarRange,
} from 'lucide-react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { AppLoading } from '@/shared/ui/AppLoading'
import { AppPagination } from '@/shared/ui/AppPagination'
import { ActiveFiltersSummary, DataEmptyState, DataFreshnessBadge } from '@/shared/components/data-state'
import { useOpportunityData } from '../hooks/useOpportunityData'
import type { OpportunitySnapshotItem } from '../types'

const columnHelper = createColumnHelper<OpportunitySnapshotItem>()
const PAGE_SIZE = 12

const STAGE_STYLE: Record<string, string> = {
  线索: 'bg-[rgba(148,163,184,0.10)] text-[#64748b]',
  商机: 'bg-[rgba(34,197,94,0.10)] text-[var(--color-accent-hover)]',
  内部投决: 'bg-[rgba(217,119,6,0.10)] text-[#a55406]',
  客户投决: 'bg-[rgba(59,130,246,0.10)] text-[#2563eb]',
  签约: 'bg-[rgba(16,185,129,0.10)] text-[#0f8a64]',
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function formatSnapshotDate(value: string) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function formatRevenue(value: number | null) {
  if (value == null) return '-'
  return `${value.toLocaleString('zh-CN')} 万`
}

function StageBadge({ stage }: { stage: string }) {
  const style = STAGE_STYLE[stage] ?? 'bg-[rgba(15,23,42,0.06)] text-[var(--color-text-muted)]'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-caption font-semibold ${style}`}>
      {stage}
    </span>
  )
}

function OpportunityMobileCard({ row }: { row: OpportunitySnapshotItem }) {
  return (
    <div className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-white/92 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-caption text-[var(--color-text-muted)]">
            {row.region ?? '未分区域'} / {row.opportunity_attribute ?? '未分属性'}
          </div>
          <div className="mt-1 line-clamp-2 font-medium leading-snug text-[var(--color-text-strong)]">
            {row.project_name}
          </div>
        </div>
        <StageBadge stage={row.stage_label} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-caption">
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2">
          <div className="text-[var(--color-text-muted)]">获取途径</div>
          <div className="mt-1 text-[var(--color-text-strong)]">{row.acquisition_channel ?? '-'}</div>
        </div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2">
          <div className="text-[var(--color-text-muted)]">预计完成</div>
          <div className="mt-1 text-[var(--color-text-strong)]">{formatDate(row.expected_finish_date)}</div>
        </div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2">
          <div className="text-[var(--color-text-muted)]">负责市场人员</div>
          <div className="mt-1 text-[var(--color-text-strong)]">{row.market_owner ?? '-'}</div>
        </div>
        <div className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2">
          <div className="text-[var(--color-text-muted)]">预期首年营收</div>
          <div className="mt-1 font-semibold text-[var(--color-text-strong)]">{formatRevenue(row.first_year_revenue)}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[rgba(15,23,42,0.03)] px-3 py-2.5">
        <div className="text-caption text-[var(--color-text-muted)]">推进进度</div>
        <div className="mt-1 whitespace-pre-line text-caption leading-relaxed text-[var(--color-text-strong)]">
          {row.progress_note ?? '暂无推进进度'}
        </div>
      </div>
    </div>
  )
}

export function OpportunityPage() {
  const {
    rows,
    snapshotDates,
    selectedSnapshotDate,
    setSelectedSnapshotDate,
    loading,
  } = useOpportunityData()
  const [pageIndex, setPageIndex] = useState(0)

  const columns = useMemo(
    () => [
      columnHelper.accessor('region', {
        header: '区域',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue() ?? '-'}</span>,
      }),
      columnHelper.accessor('opportunity_attribute', {
        header: '商机属性',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue() ?? '-'}</span>,
      }),
      columnHelper.accessor('acquisition_channel', {
        header: '获取途径',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue() ?? '-'}</span>,
      }),
      columnHelper.accessor('project_name', {
        header: '项目名称',
        cell: (info) => (
          <div className="max-w-[280px]">
            <div className="line-clamp-2 font-medium leading-snug text-[var(--color-text-strong)]">
              {info.getValue()}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('stage_label', {
        header: '推进阶段',
        cell: (info) => <StageBadge stage={info.getValue()} />,
      }),
      columnHelper.accessor('market_owner', {
        header: '负责市场人员',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue() ?? '-'}</span>,
      }),
      columnHelper.accessor('progress_note', {
        header: '推进进度',
        cell: (info) => (
          <div className="max-w-[420px] line-clamp-2 whitespace-pre-line leading-relaxed text-[var(--color-text-muted)]">
            {info.getValue() ?? '-'}
          </div>
        ),
      }),
      columnHelper.accessor('expected_finish_date', {
        header: '预计完成时间',
        cell: (info) => <span className="app-cell-muted app-cell-numeric">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.accessor('first_year_revenue', {
        header: '预期首年营收额',
        cell: (info) => (
          <span className="app-cell-strong app-cell-numeric whitespace-nowrap font-semibold">
            {formatRevenue(info.getValue())}
          </span>
        ),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      pagination: {
        pageIndex,
        pageSize: PAGE_SIZE,
      },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater
      setPageIndex(next.pageIndex)
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const handleSnapshotChange = (value: string) => {
    setSelectedSnapshotDate(value)
    setPageIndex(0)
  }

  return (
    <div className="app-page">
      <section className="app-table-shell opportunity-table-shell">
        <div className="app-table-toolbar opportunity-table-toolbar">
          <div className="app-table-title flex-col items-start gap-2">
            <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-[var(--color-text-muted)]" />
            <h3>商机明细</h3>
            <span className="app-table-meta">
              {selectedSnapshotDate ? formatSnapshotDate(selectedSnapshotDate) : '暂无快照'}
            </span>
            </div>
            <DataFreshnessBadge source="Supabase / 商机快照" updatedAt={selectedSnapshotDate || undefined} />
            <ActiveFiltersSummary filters={[selectedSnapshotDate ? `快照 ${formatSnapshotDate(selectedSnapshotDate)}` : '暂无快照']} />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.32)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.48)]">
            <CalendarRange size={15} className="text-[var(--color-text-muted)]" />
            <select
              value={selectedSnapshotDate}
              onChange={(event) => handleSnapshotChange(event.target.value)}
              className="app-filter-control min-w-[152px] bg-transparent pr-7"
            >
              {snapshotDates.map((date) => (
                <option key={date} value={date}>
                  {formatSnapshotDate(date)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <AppLoading label="加载商机数据..." variant="block" />
          </div>
        ) : rows.length === 0 ? (
          <DataEmptyState title="当前快照暂无商机数据" description="请切换其他快照，或先导入最新商机台账。" />
        ) : (
          <>
            <div className="space-y-3 px-4 py-4 lg:hidden">
              {table.getRowModel().rows.map((row) => (
                <OpportunityMobileCard key={row.id} row={row.original} />
              ))}
            </div>

            <div className="app-table-scroll opportunity-table-scroll hidden lg:block">
              <table className="app-data-table opportunity-data-table">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="text-left">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AppPagination
              page={table.getState().pagination.pageIndex + 1}
              total={rows.length}
              pageSize={table.getState().pagination.pageSize}
              onChange={(nextPage) => setPageIndex(nextPage - 1)}
            />
          </>
        )}
      </section>
    </div>
  )
}
