import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react'
import type { BizDataNode, MetricCategory } from '@/lib/supabase'
import { getChildren } from '@/services/bizDataService'

interface IntegratedComparisonTableProps {
  nodes: BizDataNode[]
  allNodes: BizDataNode[]
  metric: MetricCategory
}

// Format helpers
function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '-'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + suffix
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return (v * 100).toFixed(1) + '%'
}

function rateBg(rate: number | null | undefined): string {
  if (rate == null) return 'bg-gray-100 text-gray-500'
  if (rate >= 0.90) return 'bg-success-100 text-success-700'
  if (rate >= 0.70) return 'bg-warning-100 text-warning-700'
  return 'bg-error-100 text-error-700'
}

export function IntegratedComparisonTable({
  nodes,
  allNodes,
  metric,
}: IntegratedComparisonTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const isRateMetric = ['gross_margin', 'pretax_margin', 'labor_cost_rate'].includes(metric)
  const formatValue = isRateMetric ? fmtPct : fmt

  // Define columns
  const columns = useMemo<ColumnDef<BizDataNode>[]>(
    () => [
      {
        id: 'node_name',
        header: '业务单元',
        accessorFn: (row) => row.node_name,
        cell: ({ row, getValue }) => {
          const hasChildren = getChildren(row.original, allNodes).length > 0
          const isTotal = row.original.hierarchy.is_aggregated && row.original.hierarchy.aggregation_level === 'total'

          return (
            <div
              className="flex items-center gap-1.5"
              style={{ paddingLeft: `${row.depth * 20}px` }}
            >
              {hasChildren ? (
                <button
                  onClick={row.getToggleExpandedHandler()}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown size={14} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <span className={isTotal ? 'font-semibold text-primary-700' : 'text-gray-700'}>
                {getValue() as string}
              </span>
            </div>
          )
        },
        size: 250,
      },
      {
        id: 'actual',
        header: '实际值',
        accessorFn: (row) => row.metrics[metric]?.actual,
        cell: ({ getValue }) => (
          <div className="text-right font-medium text-gray-900">
            {formatValue(getValue() as number | null)}
          </div>
        ),
        size: 120,
      },
      {
        id: 'fone_budget',
        header: () => (
          <div className="text-right">
            <div>年初预算</div>
            <div className="text-xs font-normal text-gray-500">完成率 / 差异</div>
          </div>
        ),
        accessorFn: (row) => row.metrics[metric]?.budget_fone,
        cell: ({ row }) => {
          const metricData = row.original.metrics[metric]
          if (!metricData) return <div className="text-right text-gray-400">-</div>

          return (
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">
                {formatValue(metricData.budget_fone)}
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rateBg(metricData.completion_fone)}`}>
                  {fmtPct(metricData.completion_fone)}
                </span>
                {metricData.diff_fone != null && (
                  <span className={`text-xs ${metricData.diff_fone >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                    {metricData.diff_fone >= 0 ? '+' : ''}{formatValue(metricData.diff_fone)}
                  </span>
                )}
              </div>
            </div>
          )
        },
        size: 160,
      },
      {
        id: 'tuwei_target',
        header: () => (
          <div className="text-right">
            <div>突围考核</div>
            <div className="text-xs font-normal text-gray-500">完成率 / 差异</div>
          </div>
        ),
        accessorFn: (row) => row.metrics[metric]?.budget_tuwei,
        cell: ({ row }) => {
          const metricData = row.original.metrics[metric]
          if (!metricData) return <div className="text-right text-gray-400">-</div>

          return (
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">
                {formatValue(metricData.budget_tuwei)}
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rateBg(metricData.completion_tuwei)}`}>
                  {fmtPct(metricData.completion_tuwei)}
                </span>
                {metricData.diff_tuwei != null && (
                  <span className={`text-xs ${metricData.diff_tuwei >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                    {metricData.diff_tuwei >= 0 ? '+' : ''}{formatValue(metricData.diff_tuwei)}
                  </span>
                )}
              </div>
            </div>
          )
        },
        size: 160,
      },
      {
        id: 'yoy',
        header: () => (
          <div className="text-right">
            <div>同比</div>
            <div className="text-xs font-normal text-gray-500">同期值 / 增长</div>
          </div>
        ),
        accessorFn: (row) => row.metrics[metric]?.yoy,
        cell: ({ row }) => {
          const metricData = row.original.metrics[metric]
          if (!metricData || metricData.yoy == null) {
            return <div className="text-right text-gray-400">-</div>
          }

          const yoyDiff = metricData.actual != null && metricData.yoy != null
            ? metricData.actual - metricData.yoy
            : null

          return (
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">
                {formatValue(metricData.yoy)}
              </div>
              {yoyDiff != null && (
                <div className={`text-xs font-medium ${yoyDiff >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                  {yoyDiff >= 0 ? '+' : ''}{formatValue(yoyDiff)}
                </div>
              )}
            </div>
          )
        },
        size: 140,
      },
    ],
    [metric, allNodes, formatValue, isRateMetric]
  )

  // Build table with hierarchy support
  const table = useReactTable({
    data: nodes,
    columns,
    state: {
      sorting,
      expanded,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => {
      const children = getChildren(row, allNodes)
      return children.length > 0 ? children : undefined
    },
  })

  return (
    <div className="bg-surface rounded-lg border border-gray-200 shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-3 px-4 font-medium text-gray-600"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? 'cursor-pointer select-none flex items-center gap-2'
                            : ''
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <ArrowUpDown size={14} className="text-gray-400" />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => {
              const isTotal = row.original.hierarchy.is_aggregated && row.original.hierarchy.aggregation_level === 'total'
              return (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50/60 transition-colors ${
                    isTotal ? 'bg-primary-50 font-semibold border-t-2 border-primary-200' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

