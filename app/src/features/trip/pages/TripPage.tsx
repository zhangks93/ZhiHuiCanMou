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

export function TripPage() {
  const { trips, ongoingTrips, loading } = useTripData()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo(
    () => [
      columnHelper.accessor('employee_name', {
        header: '姓名',
        cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: '部门',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('opportunity_name', {
        header: '商机名称',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('customer_name', {
        header: '客户',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('start_time', {
        header: '出发时间',
        cell: (info) => <span className="text-gray-600">{formatDateTime(info.getValue())}</span>,
      }),
      columnHelper.accessor('end_time', {
        header: '返回时间',
        cell: (info) => <span className="text-gray-600">{formatDateTime(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'days',
        header: '天数',
        cell: (props) => (
          <span className="text-gray-600 text-center block">
            {calculateDays(props.row.original.start_time, props.row.original.end_time)}
          </span>
        ),
      }),
      columnHelper.accessor('reason', {
        header: '事由',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
      }),
    ],
    [],
  )

  const ongoingColumns = useMemo(
    () => [
      columnHelper.accessor('employee_name', {
        header: '姓名',
        cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: '部门',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('customer_name', {
        header: '客户',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('start_time', {
        header: '出发时间',
        cell: (info) => <span className="text-gray-600">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.accessor('end_time', {
        header: '返回时间',
        cell: (info) => <span className="text-gray-600">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.accessor('reason', {
        header: '事由',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
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
              <Plane size={18} className="text-gray-600" />
              <h3 className="font-medium text-gray-900">当前在途人员</h3>
              <span className="text-caption bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{ongoingTrips.length}人</span>
            </div>
            <div className="app-table-scroll">
              <table className="app-data-table text-body">
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
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-600" />
              <h3 className="font-medium text-gray-900">当前在途{ongoingTrips.length}人</h3>
            </div>
            <input
              type="text"
              placeholder="搜索姓名、部门、客户..."
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="input input-sm w-full max-w-[260px]"
            />
          </div>
          <div className="app-table-scroll">
            <table className="app-data-table text-body">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="cursor-pointer select-none text-left"
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
              <div className="text-center py-8 text-gray-400">
                暂无出差记录
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between px-5 pb-5">
            <div className="text-body text-gray-600">
              共 {table.getFilteredRowModel().rows.length} 条记录
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 text-body border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="text-body text-gray-600">
                第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-3 py-1 text-body border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
