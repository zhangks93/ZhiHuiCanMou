import { useState, useEffect, useMemo } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Plane, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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

interface BusinessTrip {
  id: number
  opportunity_name: string
  customer_name: string
  start_time: string
  end_time: string
  reason: string
  employee_name: string
  employee_id: string
  department: string
}

const columnHelper = createColumnHelper<BusinessTrip>()

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-2xl font-semibold text-gray-800">
        {value}
        {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
    </div>
  )
}

export function Trip() {
  const [trips, setTrips] = useState<BusinessTrip[]>([])
  const [ongoingTrips, setOngoingTrips] = useState<BusinessTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  useEffect(() => {
    fetchTrips()
  }, [])

  const fetchTrips = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('business_trips')
      .select('*')
      .order('start_time', { ascending: false })

    if (error) {
      console.error('获取出差数据失败:', error)
      setLoading(false)
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const ongoing = data?.filter(trip => {
      const start = new Date(trip.start_time)
      start.setHours(0, 0, 0, 0)
      const end = new Date(trip.end_time)
      end.setHours(0, 0, 0, 0)
      return start <= today && end >= today
    }) || []

    setTrips(data || [])
    setOngoingTrips(ongoing)
    setLoading(false)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diff = endDate.getTime() - startDate.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('employee_name', {
        header: '姓名',
        cell: info => <span className="font-medium text-gray-900">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: '部门',
        cell: info => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('opportunity_name', {
        header: '商机名称',
        cell: info => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('customer_name', {
        header: '客户',
        cell: info => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('start_time', {
        header: '出发时间',
        cell: info => <span className="text-gray-600">{formatDateTime(info.getValue())}</span>,
      }),
      columnHelper.accessor('end_time', {
        header: '返回时间',
        cell: info => <span className="text-gray-600">{formatDateTime(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'days',
        header: '天数',
        cell: props => (
          <span className="text-gray-600 text-center block">
            {calculateDays(props.row.original.start_time, props.row.original.end_time)}
          </span>
        ),
      }),
      columnHelper.accessor('reason', {
        header: '事由',
        cell: info => <span className="text-gray-600">{info.getValue()}</span>,
      }),
    ],
    []
  )

  const ongoingColumns = useMemo(
    () => [
      columnHelper.accessor('employee_name', {
        header: '姓名',
        cell: info => <span className="font-medium text-gray-900">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: '部门',
        cell: info => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('customer_name', {
        header: '客户',
        cell: info => <span className="text-gray-600">{info.getValue()}</span>,
      }),
      columnHelper.accessor('start_time', {
        header: '出发时间',
        cell: info => <span className="text-gray-600">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.accessor('end_time', {
        header: '返回时间',
        cell: info => <span className="text-gray-600">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.accessor('reason', {
        header: '事由',
        cell: info => <span className="text-gray-600">{info.getValue()}</span>,
      }),
    ],
    []
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

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthTrips = trips.filter(trip => new Date(trip.start_time) >= monthStart)
  const totalDays = monthTrips.reduce((sum, trip) => sum + calculateDays(trip.start_time, trip.end_time), 0)
  const uniqueEmployees = new Set(monthTrips.map(t => t.employee_id)).size
  const avgDays = uniqueEmployees > 0 ? (totalDays / uniqueEmployees).toFixed(1) : '0'

  if (loading) {
    return (
      <>
        <PageTitle breadcrumb="业务管理 / 出差管理" title="出差管理" />
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <Plane size={40} className="mx-auto text-gray-300 animate-pulse" />
          <p className="text-gray-400 mt-4">加载中...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle breadcrumb="业务管理 / 出差管理" title="出差管理" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="当前在途人员" value={ongoingTrips.length} unit="人" />
        <StatCard label="本月出差人次" value={monthTrips.length} unit="次" />
        <StatCard label="本月出差天数" value={totalDays} unit="天" />
        <StatCard label="人均出差天数" value={avgDays} unit="天" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {ongoingTrips.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plane size={18} className="text-gray-600" />
              <h3 className="font-medium text-gray-900">当前在途人员</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{ongoingTrips.length}人</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {ongoingTable.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="bg-gray-50 border-y border-gray-200">
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="text-left py-2 px-3 font-medium text-gray-700">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {ongoingTable.getRowModel().rows.map(row => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="py-2 px-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-600" />
              <h3 className="font-medium text-gray-900">出差记录</h3>
            </div>
            <input
              type="text"
              placeholder="搜索姓名、部门、客户..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="bg-gray-50 border-y border-gray-200">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="text-left py-2 px-3 font-medium text-gray-700 cursor-pointer select-none"
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
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="py-2 px-3">
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
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              共 {table.getFilteredRowModel().rows.length} 条记录
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
