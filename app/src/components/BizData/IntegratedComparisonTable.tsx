import React, { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
  type CellContext,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { EnrichedBizDataNode, MetricCategory } from '@/lib/supabase'
import { getChildren } from '@/services/bizDataService'

interface IntegratedComparisonTableProps {
  nodes: EnrichedBizDataNode[]
  allNodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
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

// Metric groups for consolidated display
const METRIC_GROUPS: Array<{
  title: string
  metrics: Array<{ key: MetricCategory; label: string; isRate: boolean }>
}> = [
  {
    title: '核心指标',
    metrics: [
      { key: 'revenue', label: '营收', isRate: false },
      { key: 'pretax_profit', label: '利润', isRate: false },
      { key: 'gross_profit', label: '毛利', isRate: false },
      { key: 'gross_margin', label: '毛利率', isRate: true },
    ],
  },
  {
    title: '成本指标',
    metrics: [
      { key: 'labor_cost', label: '人力成本', isRate: false },
      { key: 'labor_cost_rate', label: '人力成本率', isRate: true },
      { key: 'other_expense', label: '其他支出', isRate: false },
    ],
  },
  {
    title: '效率指标',
    metrics: [
      { key: 'headcount', label: '人数', isRate: false },
      { key: 'per_capita_revenue', label: '人均营收', isRate: false },
      { key: 'revenue_creation', label: '一元创收', isRate: false },
      { key: 'profit_creation', label: '一元创利', isRate: false },
    ],
  },
]

export function IntegratedComparisonTable({
  nodes,
  allNodes,
  reportType,
}: IntegratedComparisonTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  // Determine column labels based on reportType
  const budgetLabel = reportType === 'fone' ? '年初预算' : '突围考核'
  const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'
  const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'
  const diffField = reportType === 'fone' ? 'diff_fone' : 'diff_tuwei'

  // Define columns
  const columns = useMemo<ColumnDef<EnrichedBizDataNode>[]>(
    () => {
      const cols: ColumnDef<EnrichedBizDataNode>[] = [
        {
          id: 'node_name',
          header: '业务单元',
          accessorFn: (row) => row.node_name,
          cell: ({ row, getValue }) => {
            const hasChildren = getChildren(row.original, allNodes).length > 0
            const isTotal = row.original.orgHierarchy.level_0 === row.original.node_name

            return (
              <div
                className="flex items-center gap-1.5"
                style={{ paddingLeft: `${row.depth * 20}px` }}
              >
                {hasChildren ? (
                  <button
                    onClick={row.getToggleExpandedHandler()}
                    className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                  >
                    {row.getIsExpanded() ? (
                      <ChevronDown size={16} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-500" />
                    )}
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                <span className={isTotal ? 'font-semibold text-primary-700' : 'text-gray-800'}>
                  {getValue() as string}
                </span>
              </div>
            )
          },
          size: 200,
        },
        {
          id: 'metric',
          header: '指标',
          accessorFn: () => '',
          cell: () => null,
          size: 100,
        },
        {
          id: 'actual',
          header: '实际值',
          accessorFn: () => '',
          cell: () => null,
          size: 100,
        },
        {
          id: 'budget',
          header: () => (
            <div className="text-center">
              <div className="font-semibold">{budgetLabel}</div>
              <div className="text-xs font-normal text-gray-500 mt-0.5">预算 / 完成率 / 差异</div>
            </div>
          ),
          accessorFn: () => '',
          cell: () => null,
          size: 240,
        },
        {
          id: 'yoy',
          header: () => (
            <div className="text-center">
              <div className="font-semibold">同比</div>
              <div className="text-xs font-normal text-gray-500 mt-0.5">同期值 / 增长</div>
            </div>
          ),
          accessorFn: () => '',
          cell: () => null,
          size: 160,
        },
      ]

      return cols
    },
    [allNodes, budgetLabel]
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
    <div className="space-y-6">
      {METRIC_GROUPS.map((group) => (
        <div key={group.title} className="bg-surface rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Group Header */}
          <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 px-4 py-3 border-b border-primary-200">
            <h3 className="text-sm font-semibold text-primary-800">{group.title}</h3>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200 sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wide"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const isTotal = row.original.orgHierarchy.level_0 === row.original.node_name

                  return (
                    <React.Fragment key={row.id}>
                      {group.metrics.map((metric, metricIdx) => {
                        const metricData = row.original.metrics[metric.key]
                        const formatValue = metric.isRate ? fmtPct : fmt
                        const isFirstMetric = metricIdx === 0

                        return (
                          <tr
                            key={`${row.id}-${metric.key}`}
                            className={`border-b border-gray-100 hover:bg-gray-50/60 transition-colors ${
                              isTotal ? 'bg-primary-50/30' : ''
                            } ${isFirstMetric ? 'border-t-2 border-gray-200' : ''}`}
                          >
                            {/* Node Name (only show on first metric row) */}
                            {isFirstMetric ? (
                              <td
                                className="py-2.5 px-4 align-top border-r border-gray-200"
                                rowSpan={group.metrics.length}
                              >
                                {flexRender(
                                  table.getHeaderGroups()[0].headers[0].column.columnDef.cell,
                                  { row, getValue: () => row.original.node_name } as CellContext<EnrichedBizDataNode, unknown>
                                )}
                              </td>
                            ) : null}

                            {/* Metric Label */}
                            <td className="py-2 px-4 text-gray-600 text-xs font-medium">
                              {metric.label}
                            </td>

                            {/* Actual Value */}
                            <td className="py-2 px-4 text-right">
                              <span className="font-semibold text-gray-900">
                                {formatValue(metricData?.actual)}
                              </span>
                            </td>

                            {/* Budget Column */}
                            <td className="py-2 px-4">
                              {metricData ? (
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="text-gray-600 min-w-[60px]">
                                    {formatValue(metricData[budgetField])}
                                  </span>
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded font-medium min-w-[50px] text-center ${rateBg(
                                      metricData[completionField]
                                    )}`}
                                  >
                                    {fmtPct(metricData[completionField])}
                                  </span>
                                  {metricData[diffField] != null && (
                                    <span
                                      className={`font-medium min-w-[60px] text-right ${
                                        metricData[diffField] >= 0 ? 'text-success-700' : 'text-error-700'
                                      }`}
                                    >
                                      {metricData[diffField] >= 0 ? '+' : ''}
                                      {formatValue(metricData[diffField])}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center text-gray-400">-</div>
                              )}
                            </td>

                            {/* YoY */}
                            <td className="py-2 px-4">
                              {metricData && metricData.yoy != null ? (
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-gray-600 min-w-[60px]">
                                    {formatValue(metricData.yoy)}
                                  </span>
                                  {metricData.actual != null && (
                                    <span
                                      className={`font-medium min-w-[60px] text-right ${
                                        metricData.actual - metricData.yoy >= 0
                                          ? 'text-success-700'
                                          : 'text-error-700'
                                      }`}
                                    >
                                      {metricData.actual - metricData.yoy >= 0 ? '+' : ''}
                                      {formatValue(metricData.actual - metricData.yoy)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center text-gray-400">-</div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
