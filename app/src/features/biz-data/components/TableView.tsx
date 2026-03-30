import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
import { METRIC_LABELS } from '@/shared/lib/constants'
import { fmt, fmtPct } from '@/shared/lib/format'
import type { EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import { getChildren, buildTreeWithAggregation } from '@/features/biz-data/services/bizDataService'
import type { LevelVisibility } from './HierarchyLevelFilter'
import {
  getNodeThresholds,
  getAlertLevel,
  getAlertColorClass,
  getAlertBgClass,
  getAlertBorderClass,
  subscribeThresholdSettings,
} from '@/shared/lib/thresholdConfig'

interface TableViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
  showLevels: LevelVisibility
}

const HEADER_CONTENT_CLASS =
  'flex min-h-[84px] flex-col justify-center gap-1.5 px-3 py-3'

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
      className={`${HEADER_CONTENT_CLASS} relative group`}
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

export function TableView({ nodes, reportType, selectedMetrics, showLevels }: TableViewProps) {
  const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'
  const completionField = reportType === 'fone' ? 'completion_fone' : 'completion_tuwei'

  const [metricOrder, setMetricOrder] = useState<MetricCategory[]>(selectedMetrics)
  const [thresholdVersion, setThresholdVersion] = useState(0)
  const leftHeaderRowRef = useRef<HTMLTableRowElement | null>(null)
  const metricHeaderRowRef = useRef<HTMLTableRowElement | null>(null)
  const leftRowRefs = useRef<Array<HTMLTableRowElement | null>>([])
  const metricRowRefs = useRef<Array<HTMLTableRowElement | null>>([])

  useEffect(() => {
    return subscribeThresholdSettings(() => {
      setThresholdVersion((v) => v + 1)
    })
  }, [])

  useEffect(() => {
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
    const level0Nodes = allNodesWithAggregation.filter((node) => getNodeLevel(node) === 0)
    if (level0Nodes.length > 0 && showLevels.level0) {
      return level0Nodes
    }
    return allNodesWithAggregation.filter((node) => {
      const level = getNodeLevel(node)
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
                className="p-0.5 hover:bg-[rgba(34,197,94,0.08)] rounded-md transition-colors"
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
            <span className="font-medium text-[var(--color-text-strong)]">{getValue() as string}</span>
          </div>
        )
      },
      size: 280,
    },
    ...metricOrder.flatMap((metric) => [
      {
        id: `${metric}_actual`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.actual,
        header: `${METRIC_LABELS[metric]} - 实际`,
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <span className="font-medium text-[var(--color-text-strong)]">{fmt(getValue() as number)}</span>
        ),
        size: 100,
      },
      {
        id: `${metric}_budget`,
        accessorFn: (row: EnrichedBizDataNode) => row.metrics[metric]?.[budgetField],
        header: `${METRIC_LABELS[metric]} - 预算`,
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <span className="text-[var(--color-text-muted)]">{fmt(getValue() as number)}</span>
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
              <span className={`font-semibold ${colorClass}`}>
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
      return children.filter((child) => {
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

  const visibleRows = table.getRowModel().rows
  const visibleRowIds = visibleRows.map((row) => row.id).join('|')

  const syncPairedHeights = useCallback(() => {
    const resetHeight = (element: HTMLTableRowElement | null) => {
      if (element) {
        element.style.height = ''
      }
    }

    resetHeight(leftHeaderRowRef.current)
    resetHeight(metricHeaderRowRef.current)
    leftRowRefs.current.forEach(resetHeight)
    metricRowRefs.current.forEach(resetHeight)

    const syncPair = (left: HTMLTableRowElement | null, right: HTMLTableRowElement | null) => {
      if (!left || !right) return
      const height = Math.ceil(Math.max(left.getBoundingClientRect().height, right.getBoundingClientRect().height))
      const nextHeight = `${height}px`
      left.style.height = nextHeight
      right.style.height = nextHeight
    }

    syncPair(leftHeaderRowRef.current, metricHeaderRowRef.current)

    const rowCount = Math.max(leftRowRefs.current.length, metricRowRefs.current.length)
    for (let index = 0; index < rowCount; index += 1) {
      syncPair(leftRowRefs.current[index] ?? null, metricRowRefs.current[index] ?? null)
    }
  }, [])

  useLayoutEffect(() => {
    leftRowRefs.current = leftRowRefs.current.slice(0, visibleRows.length)
    metricRowRefs.current = metricRowRefs.current.slice(0, visibleRows.length)
    syncPairedHeights()
  }, [metricOrder, syncPairedHeights, visibleRowIds, visibleRows.length])

  useEffect(() => {
    const handleResize = () => {
      syncPairedHeights()
    }

    window.addEventListener('resize', handleResize)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    const observer = new ResizeObserver(() => {
      syncPairedHeights()
    })

    const observedElements = [
      leftHeaderRowRef.current?.closest('table'),
      metricHeaderRowRef.current?.closest('table'),
    ].filter((element): element is HTMLTableElement => Boolean(element))

    observedElements.forEach((element) => observer.observe(element))

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [syncPairedHeights])

  if (selectedMetrics.length === 0) {
    return (
      <div className="biz-content-area">
        <div className="app-empty-state">
          <p className="text-[var(--color-text-muted)] text-caption">请至少选择一个指标</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="app-table-shell">
          <div className="flex">
            <div className="z-20 flex-shrink-0 border-r border-[var(--color-border)] bg-white/72">
              <table className="app-data-table app-data-table-compact">
                <thead className="sticky top-0">
                  <tr ref={leftHeaderRowRef}>
                    <th className="w-72 !p-0">
                      <div className={`${HEADER_CONTENT_CLASS} items-center`}>
                        <span className="text-caption font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">业务单元</span>
                        <div className="text-caption font-medium text-transparent">占位</div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const firstCell = row.getVisibleCells()[0]
                    return (
                      <tr
                        key={row.id}
                        ref={(node) => {
                          leftRowRefs.current[index] = node
                        }}
                      >
                        <td className="w-72 align-middle">
                          {flexRender(firstCell.column.columnDef.cell, firstCell.getContext())}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="app-table-scroll flex-1">
              <table className="app-data-table app-data-table-compact">
                <thead className="sticky top-0">
                  <tr ref={metricHeaderRowRef}>
                    <SortableContext
                      items={metricOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {metricOrder.map((metric) => (
                        <th key={metric} className="!p-0">
                          <DraggableHeader id={metric}>
                            <div className="flex min-w-[300px] flex-col gap-1.5">
                              <span className="text-caption font-semibold uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                                {METRIC_LABELS[metric]}
                              </span>
                              <div className="grid grid-cols-3 gap-1.5 text-caption font-medium text-[var(--color-text-muted)]">
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
                <tbody>
                  {visibleRows.map((row, index) => {
                    const metricCells = row.getVisibleCells().slice(1)
                    return (
                      <tr
                        key={row.id}
                        ref={(node) => {
                          metricRowRefs.current[index] = node
                        }}
                      >
                        {metricOrder.map((metric) => {
                          const actualCell = metricCells.find((cell) => cell.column.id === `${metric}_actual`)
                          const budgetCell = metricCells.find((cell) => cell.column.id === `${metric}_budget`)
                          const completionCell = metricCells.find((cell) => cell.column.id === `${metric}_completion`)

                          return (
                            <td key={metric} className="border-r border-[rgba(148,163,184,0.08)] last:border-r-0">
                              <div className="grid h-full min-w-[300px] grid-cols-3 items-center gap-1.5 px-3">
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
