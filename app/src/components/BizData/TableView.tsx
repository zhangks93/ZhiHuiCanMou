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
import { fmt, fmtPct, getCompletionColor } from '@/lib/format'
import { getChildren, buildTreeWithAggregation } from '@/services/bizDataService'

interface TableViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
}

// Draggable header component
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
      className="px-4 py-3 relative group"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0"
          title="拖动调整顺序"
        >
          <GripVertical size={16} className="text-gray-400 hover:text-gray-600" />
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

  // State for metric order
  const [metricOrder, setMetricOrder] = useState<MetricCategory[]>(selectedMetrics)

  // State for aggregation level filter (based on edu_org_hierarchy levels)
  const [showLevels, setShowLevels] = useState({
    level1: true,   // level_1 nodes (top level)
    level2: true,   // level_2 nodes (second level)
    level3: true,   // level_3 nodes (third level)
    level4: true,   // node_name nodes (leaf nodes - actual business units)
  })

  // Update metric order when selectedMetrics changes
  useMemo(() => {
    setMetricOrder(selectedMetrics)
  }, [selectedMetrics])

  // Build complete tree with aggregated data
  const allNodesWithAggregation = useMemo(() => {
    return buildTreeWithAggregation(nodes)
  }, [nodes])

  // Determine node level based on orgHierarchy and node_name
  const getNodeLevel = (node: EnrichedBizDataNode): 1 | 2 | 3 | 4 | null => {
    const { level_1, level_2, level_3 } = node.orgHierarchy
    const { node_name } = node

    // Level 1: only level_1, node_name = level_1
    if (level_1 && !level_2 && !level_3 && node_name === level_1) return 1

    // Level 2: level_1 + level_2, node_name = level_2
    if (level_1 && level_2 && !level_3 && node_name === level_2) return 2

    // Level 3: level_1 + level_2 + level_3, node_name = level_3
    if (level_1 && level_2 && level_3 && node_name === level_3) return 3

    // Level 4: level_1 + level_2 + level_3, node_name ≠ level_3 (actual business units)
    if (level_1 && level_2 && level_3 && node_name !== level_3) return 4

    return null
  }

  // Filter nodes based on selected levels and get only top-level nodes for display
  const filteredRootNodes = useMemo(() => {
    // Return only level_1 nodes as root nodes
    return allNodesWithAggregation.filter(n => {
      const level = getNodeLevel(n)
      return level === 1 && showLevels.level1
    })
  }, [allNodesWithAggregation, showLevels])

  // Drag and drop sensors
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
            className="flex items-center gap-2"
            style={{ paddingLeft: `${row.depth * 24}px` }}
          >
            {hasChildren ? (
              <button
                onClick={row.getToggleExpandedHandler()}
                className="p-0.5 hover:bg-gray-100 rounded transition-colors"
              >
                {row.getIsExpanded() ? (
                  <ChevronDown size={16} className="text-gray-600" />
                ) : (
                  <ChevronRight size={16} className="text-gray-600" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="font-medium text-gray-900">{getValue() as string}</span>
          </div>
        )
      },
      size: 300,
    },
    ...metricOrder.flatMap(metric => [
      {
        id: `${metric}_actual`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.actual,
        header: `${METRIC_LABELS[metric]} - 实际`,
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <span className="font-medium text-gray-900">{fmt(getValue() as number)}</span>
        ),
        size: 120,
      },
      {
        id: `${metric}_budget`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.[budgetField],
        header: `${METRIC_LABELS[metric]} - 预算`,
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <span className="text-gray-700">{fmt(getValue() as number)}</span>
        ),
        size: 120,
      },
      {
        id: `${metric}_completion`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.[completionField],
        header: `${METRIC_LABELS[metric]} - 完成率`,
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue() as number | null
          return (
            <span className={`font-semibold ${getCompletionColor(value)}`}>
              {fmtPct(value)}
            </span>
          )
        },
        size: 100,
      },
    ]),
  ], [metricOrder, budgetField, completionField, allNodesWithAggregation])

  const table = useReactTable({
    data: filteredRootNodes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => {
      const children = getChildren(row, allNodesWithAggregation)
      // Filter children based on level visibility
      return children.filter(child => {
        const level = getNodeLevel(child)
        if (level === 2) return showLevels.level2
        if (level === 3) return showLevels.level3
        if (level === 4) return showLevels.level4
        return true
      })
    },
    initialState: {
      expanded: {},
    },
  })

  if (selectedMetrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">请至少选择一个指标</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Level Filter */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">显示层级:</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLevels.level1}
              onChange={(e) => setShowLevels(prev => ({ ...prev, level1: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">一级（level_1）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLevels.level2}
              onChange={(e) => setShowLevels(prev => ({ ...prev, level2: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">二级（level_2）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLevels.level3}
              onChange={(e) => setShowLevels(prev => ({ ...prev, level3: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">三级（level_3）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLevels.level4}
              onChange={(e) => setShowLevels(prev => ({ ...prev, level4: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">四级（业务单元）</span>
          </label>
        </div>
      </div>

      {/* Table with fixed first column and horizontal scroll */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex">
            {/* Fixed first column */}
            <div className="flex-shrink-0 border-r-2 border-gray-300 bg-white z-20">
              <table className="border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-900 w-80 border-b-2 border-gray-300">
                      业务单元
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map(row => {
                    const firstCell = row.getVisibleCells()[0]
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm w-80">
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
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <SortableContext
                      items={metricOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {metricOrder.map(metric => (
                        <th key={metric} className="border-b-2 border-gray-300">
                          <DraggableHeader id={metric}>
                            <div className="flex flex-col gap-2 min-w-[360px]">
                              <span className="text-sm font-semibold text-gray-900">
                                {METRIC_LABELS[metric]}
                              </span>
                              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-600">
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
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map(row => {
                    const metricCells = row.getVisibleCells().slice(1)
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        {metricOrder.map(metric => {
                          const actualCell = metricCells.find(c => c.column.id === `${metric}_actual`)
                          const budgetCell = metricCells.find(c => c.column.id === `${metric}_budget`)
                          const completionCell = metricCells.find(c => c.column.id === `${metric}_completion`)

                          return (
                            <td key={metric} className="border-r border-gray-100 last:border-r-0">
                              <div className="grid grid-cols-3 gap-2 px-4 py-3 text-sm min-w-[360px]">
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
