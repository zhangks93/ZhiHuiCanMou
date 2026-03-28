import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, ChevronDown, GripVertical, Filter } from 'lucide-react'
import type { EnrichedBizDataNode, MetricCategory } from '@/lib/supabase'
import { METRIC_LABELS } from '@/lib/constants'
import { fmt, fmtPct } from '@/lib/format'
import { getChildren, buildTreeWithAggregation } from '@/services/bizDataService'
import { getNodeThresholds, getAlertLevel, getAlertColorClass, getAlertBgClass, getAlertBorderClass } from '@/lib/thresholdConfig'

interface TableViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
}

function DraggableHeader({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-3 py-3 relative group"
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          title="拖动调整顺序"
        >
          <GripVertical size={14} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]" />
        </button>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

export function TableView({ nodes, reportType, selectedMetrics }: TableViewProps) {
  const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'
  const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'

  const [metricOrder, setMetricOrder] = useState<MetricCategory[]>(selectedMetrics)
  const [thresholdVersion, setThresholdVersion] = useState(0)

  useMemo(() => {
    const handleThresholdUpdate = () => {
      setThresholdVersion(v => v + 1)
    }
    window.addEventListener('threshold-updated', handleThresholdUpdate)
    return () => window.removeEventListener('threshold-updated', handleThresholdUpdate)
  }, [])

  const [showLevels, setShowLevels] = useState({
    level0: true,
    level1: true,
    level2: true,
    level3: true,
  })

  useMemo(() => {
    setMetricOrder(selectedMetrics)
  }, [selectedMetrics])

  const allNodesWithAggregation = useMemo(() => {
    return buildTreeWithAggregation(nodes)
  }, [nodes])

  const getNodeLevel = (node: EnrichedBizDataNode): 0 | 1 | 2 | 3 | null => {
    const { level_0, level_1, level_2 } = node.orgHierarchy
    const { node_name } = node

    if (level_0 && !level_1 && !level_2 && node_name === level_0) return 0
    if (level_1 && !level_2 && node_name === level_1) return 1
    if (level_1 && level_2 && node_name === level_2) return 2
    if ((level_1 && !level_2 && node_name !== level_1) || (level_1 && level_2 && node_name !== level_2)) return 3

    return null
  }

  const filteredRootNodes = useMemo(() => {
    const level0Nodes = allNodesWithAggregation.filter(n => getNodeLevel(n) === 0)
    if (level0Nodes.length > 0 && showLevels.level0) {
      return level0Nodes
    }
    return allNodesWithAggregation.filter(n => {
      const level = getNodeLevel(n)
      return level === 1 && showLevels.level1
    })
  }, [allNodesWithAggregation, showLevels])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setMetricOrder((items) => {
        const oldIndex = items.indexOf(active.id as MetricCategory)
        const newIndex = items.indexOf(over.id as MetricCategory)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const columns = useMemo<ColumnDef<EnrichedBizDataNode>[]>(() => [
    {
      id: 'node_name',
      accessorKey: 'node_name',
      header: '业务单元',
      cell: ({ row, getValue }) => {
        const hasChildren = getChildren(row.original, allNodesWithAggregation).length > 0
        return (
          <div
            className="flex items-center gap-1.5"
            style={{ paddingLeft: `${row.depth * 20}px` }}
          >
            {hasChildren ? (
              <button
                onClick={row.getToggleExpandedHandler()}
                className="p-0.5 hover:bg-[rgba(37,99,235,0.08)] rounded-md transition-colors"
              >
                {row.getIsExpanded() ? (
                  <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
                )}
              </button>
            ) : (
              <span className="w-[18px]" />
            )}
            <span className="font-medium text-xs text-[var(--color-text-strong)]">{getValue() as string}</span>
          </div>
        )
      },
      size: 280,
    },
    ...metricOrder.flatMap(metric => [
      {
        id: `${metric}_actual`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.actual,
        header: `${METRIC_LABELS[metric]} - 实际`,
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <span className="font-medium text-xs text-[var(--color-text-strong)]">{fmt(getValue() as number)}</span>
        ),
        size: 100,
      },
      {
        id: `${metric}_budget`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.[budgetField],
        header: `${METRIC_LABELS[metric]} - 预算`,
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <span className="text-xs text-[var(--color-text-muted)]">{fmt(getValue() as number)}</span>
        ),
        size: 100,
      },
      {
        id: `${metric}_completion`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.[completionField],
        header: `${METRIC_LABELS[metric]} - 完成率`,
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue() as number | null
          const thresholds = getNodeThresholds()
          const alertLevel = getAlertLevel(value, thresholds)
          const colorClass = getAlertColorClass(alertLevel)
          const bgClass = getAlertBgClass(alertLevel)
          const borderClass = getAlertBorderClass(alertLevel)

          return (
            <div className={`inline-flex items-center px-2 py-0.5 rounded-lg border ${bgClass} ${borderClass}`}>
              <span className={`font-semibold text-xs ${colorClass}`}>
                {fmtPct(value)}
              </span>
            </div>
          )
        },
        size: 90,
      },
    ]),
  ], [metricOrder, budgetField, completionField, allNodesWithAggregation, thresholdVersion])

  const table = useReactTable({
    data: filteredRootNodes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => {
      const children = getChildren(row, allNodesWithAggregation)
      return children.filter(child => {
        const level = getNodeLevel(child)
        if (level === 1) return showLevels.level1
        if (level === 2) return showLevels.level2
        if (level === 3) return showLevels.level3
        return true
      })
    },
    initialState: {
      expanded: {},
    },
  })

  if (selectedMetrics.length === 0) {
    return (
      <div className="biz-content-area">
        <div className="app-empty-state">
          <p className="text-[var(--color-text-muted)] text-xs">请至少选择一个指标</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Level Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-[var(--color-text-muted)]" />
        <span className="text-xs font-medium text-[var(--color-text-muted)]">层级:</span>
        {[
          { key: 'level0', label: '集团' },
          { key: 'level1', label: '一级' },
          { key: 'level2', label: '二级' },
          { key: 'level3', label: '单元' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showLevels[key as keyof typeof showLevels]}
              onChange={(e) => setShowLevels(prev => ({ ...prev, [key]: e.target.checked }))}
              className="radio w-3 h-3"
            />
            <span className="text-[11px] text-[var(--color-text-muted)]">{label}</span>
          </label>
        ))}
      </div>

      {/* Table */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="biz-content-area overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="flex">
            {/* Fixed first column */}
            <div className="flex-shrink-0 border-r border-[var(--color-border)] bg-white/60 z-20">
              <table className="border-collapse">
                <thead className="bg-[rgba(15,23,42,0.03)] sticky top-0">
                  <tr>
                    <th className="px-3 py-3 w-72 border-b border-[var(--color-border)]">
                      <div className="flex flex-col gap-1.5 items-center">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">业务单元</span>
                        <div className="text-[10px] font-medium text-transparent">占位</div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(148,163,184,0.1)]">
                  {table.getRowModel().rows.map(row => {
                    const firstCell = row.getVisibleCells()[0]
                    return (
                      <tr key={row.id} className="hover:bg-[rgba(37,99,235,0.03)] transition-colors h-[44px]">
                        <td className="px-3 text-xs w-72 h-[44px] align-middle">
                          {flexRender(firstCell.column.columnDef.cell, firstCell.getContext())}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Scrollable metric columns */}
            <div className="flex-1 overflow-x-auto">
              <table className="border-collapse">
                <thead className="bg-[rgba(15,23,42,0.03)] sticky top-0">
                  <tr>
                    <SortableContext
                      items={metricOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {metricOrder.map(metric => (
                        <th key={metric} className="border-b border-[var(--color-border)]">
                          <DraggableHeader id={metric}>
                            <div className="flex flex-col gap-1.5 min-w-[300px]">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                                {METRIC_LABELS[metric]}
                              </span>
                              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                                <span className="text-center">实际</span>
                                <span className="text-center">预算</span>
                                <span className="text-center">完成率</span>
                              </div>
                            </div>
                          </DraggableHeader>
                        </th>
                      ))}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(148,163,184,0.1)]">
                  {table.getRowModel().rows.map(row => {
                    const metricCells = row.getVisibleCells().slice(1)
                    return (
                      <tr key={row.id} className="hover:bg-[rgba(37,99,235,0.03)] transition-colors h-[44px]">
                        {metricOrder.map(metric => {
                          const actualCell = metricCells.find(c => c.column.id === `${metric}_actual`)
                          const budgetCell = metricCells.find(c => c.column.id === `${metric}_budget`)
                          const completionCell = metricCells.find(c => c.column.id === `${metric}_completion`)

                          return (
                            <td key={metric} className="border-r border-[rgba(148,163,184,0.08)] last:border-r-0 h-[44px]">
                              <div className="grid grid-cols-3 gap-1.5 px-3 text-xs min-w-[300px] h-full items-center">
                                <div className="text-right">
                                  {actualCell && flexRender(actualCell.column.columnDef.cell, actualCell.getContext())}
                                </div>
                                <div className="text-right">
                                  {budgetCell && flexRender(budgetCell.column.columnDef.cell, budgetCell.getContext())}
                                </div>
                                <div className="text-right">
                                  {completionCell && flexRender(completionCell.column.columnDef.cell, completionCell.getContext())}
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  )
}
