import { useMemo, useState } from 'react'
import { Plane, Calendar } from 'lucide-react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { AppPagination } from '@/shared/ui/AppPagination'
import { useTripData } from '../hooks/useTripData'
import type { BusinessTrip } from '../api/tripRepository'

const columnHelper = createColumnHelper<BusinessTrip>()

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function calculateDays(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function TripMobileCard({ trip, compact = false }: { trip: BusinessTrip; compact?: boolean }) {
  const detailRows = [
    { label: '部门', value: trip.department || '-' },
    { label: '客户', value: trip.customer_name || '-' },
    { label: compact ? '出发' : '出发时间', value: compact ? formatDate(trip.start_time) : formatDateTime(trip.start_time) },
    { label: compact ? '返回' : '返回时间', value: compact ? formatDate(trip.end_time) : formatDateTime(trip.end_time) },
  ]

  return (
    <div className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-white/92 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-[var(--color-text-strong)]">{trip.employee_name}</div>
          <div className="mt-1 text-caption text-[var(--color-text-muted)]">
            {trip.opportunity_name || '未关联商机'}
          </div>
        </div>
        <div className="rounded-full bg-[rgba(15,23,42,0.06)] px-2.5 py-1 text-caption font-medium text-[var(--color-text-muted)]">
          {calculateDays(trip.start_time, trip.end_time)} 天
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-caption">
        {detailRows.map((item) => (
          <div key={item.label} className="rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2">
            <div className="text-[var(--color-text-muted)]">{item.label}</div>
            <div className="mt-1 text-[var(--color-text-strong)]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-[rgba(15,23,42,0.03)] px-3 py-2.5 text-caption leading-relaxed text-[var(--color-text-muted)]">
        {trip.reason || '暂无事由'}
      </div>
    </div>
  )
}

export function TripPage() {
  const { trips, ongoingTrips, loading } = useTripData()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo(
    () => [
      columnHelper.accessor('employee_name', {
        header: '姓名',
        cell: (info) => <span className="font-medium text-[var(--color-text-strong)]">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: '部门',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue()}</span>,
      }),
      columnHelper.accessor('opportunity_name', {
        header: '商机名称',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue()}</span>,
      }),
      columnHelper.accessor('customer_name', {
        header: '客户',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue()}</span>,
      }),
      columnHelper.accessor('start_time', {
        header: '出发时间',
        cell: (info) => <span className="app-cell-muted app-cell-numeric">{formatDateTime(info.getValue())}</span>,
      }),
      columnHelper.accessor('end_time', {
        header: '返回时间',
        cell: (info) => <span className="app-cell-muted app-cell-numeric">{formatDateTime(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'days',
        header: '天数',
        cell: (props) => (
          <span className="app-cell-muted app-cell-numeric block text-center">
            {calculateDays(props.row.original.start_time, props.row.original.end_time)}
          </span>
        ),
      }),
      columnHelper.accessor('reason', {
        header: '事由',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue()}</span>,
      }),
    ],
    [],
  )

  const ongoingColumns = useMemo(
    () => [
      columnHelper.accessor('employee_name', {
        header: '姓名',
        cell: (info) => <span className="font-medium text-[var(--color-text-strong)]">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: '部门',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue()}</span>,
      }),
      columnHelper.accessor('customer_name', {
        header: '客户',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue()}</span>,
      }),
      columnHelper.accessor('start_time', {
        header: '出发时间',
        cell: (info) => <span className="app-cell-muted app-cell-numeric">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.accessor('end_time', {
        header: '返回时间',
        cell: (info) => <span className="app-cell-muted app-cell-numeric">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.accessor('reason', {
        header: '事由',
        cell: (info) => <span className="text-[var(--color-text-muted)]">{info.getValue()}</span>,
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: trips,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  })

  const ongoingTable = useReactTable({
    data: ongoingTrips,
    columns: ongoingColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (loading) {
    return (
      <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-10 text-center shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
        <Plane size={40} className="mx-auto text-gray-300 animate-pulse" />
        <p className="text-gray-400 mt-4">加载中...</p>
      </div>
    )
  }

  return (
    <div className="app-page">

      <div className="grid grid-cols-1 gap-6">
        {ongoingTrips.length > 0 && (
          <section className="app-table-shell p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="app-table-title">
                <Plane size={18} className="text-[var(--color-text-muted)]" />
                <h3>当前在途人员</h3>
              </div>
              <span className="text-caption bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{ongoingTrips.length}人</span>
            </div>
            <div className="space-y-2 lg:hidden">
              {ongoingTrips.map((trip) => (
                <TripMobileCard key={trip.id} trip={trip} compact />
              ))}
            </div>
            <div className="app-table-scroll hidden lg:block">
              <table className="app-data-table">
                <thead>
                  {ongoingTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="text-left">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {ongoingTable.getRowModel().rows.map((row) => (
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
          </section>
        )}

        <section className="app-table-shell">
          <div className="app-table-toolbar">
            <div className="app-table-title">
              <Calendar size={18} className="text-[var(--color-text-muted)]" />
              <h3>出差记录</h3>
              <span className="app-table-meta">共 {table.getFilteredRowModel().rows.length} 条</span>
            </div>
            <input
              type="text"
              placeholder="搜索姓名、部门、客户..."
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="input input-sm w-full max-w-[260px]"
            />
          </div>
          <div className="space-y-2 px-3 py-3 lg:hidden">
            {table.getRowModel().rows.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                暂无出差记录
              </div>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TripMobileCard key={row.id} trip={row.original} />
              ))
            )}
          </div>
          <div className="app-table-scroll hidden lg:block">
            <table className="app-data-table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="is-sortable text-left"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
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
            {table.getRowModel().rows.length === 0 && (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                暂无出差记录
              </div>
            )}
          </div>
          <AppPagination
            page={table.getState().pagination.pageIndex + 1}
            total={table.getFilteredRowModel().rows.length}
            pageSize={table.getState().pagination.pageSize}
            onChange={(nextPage) => table.setPageIndex(nextPage - 1)}
          />
        </section>
      </div>
    </div>
  )
}
