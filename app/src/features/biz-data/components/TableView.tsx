import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type Row,
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
  getAlertLevelByMetric,
  getAlertColorClass,
  getAlertBgClass,
  getAlertBorderClass,
  getMetricDisplayCompletionRate,
  getMetricAlertRuleText,
  subscribeThresholdSettings,
} from '@/shared/lib/thresholdConfig'

interface TableViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
  showLevels: LevelVisibility
}

const BUSINESS_UNIT_COLUMN_WIDTH = 288
const METRIC_GROUP_WIDTH = 300

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
  const [, setThresholdVersion] = useState(0)
  const [bodyMaxHeight, setBodyMaxHeight] = useState<number | null>(null)
  const tableShellRef = useRef<HTMLDivElement | null>(null)
  const tableMetricsHeaderViewportRef = useRef<HTMLDivElement | null>(null)
  const tableFixedBodyViewportRef = useRef<HTMLDivElement | null>(null)
  const tableMetricsBodyHorizontalViewportRef = useRef<HTMLDivElement | null>(null)
  const tableMetricsBodyVerticalViewportRef = useRef<HTMLDivElement | null>(null)
  const tableHorizontalScrollbarRef = useRef<HTMLDivElement | null>(null)

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

  const columns = useMemo<ColumnDef<EnrichedBizDataNode>[]>(() => [
    {
      id: 'node_name',
      accessorKey: 'node_name',
    },
  ], [])

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
  const metricsTableWidth = `${metricOrder.length * METRIC_GROUP_WIDTH}px`

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

  const findClippingAncestor = useCallback((element: HTMLElement | null) => {
    let current = element?.parentElement ?? null

    while (current) {
      const style = window.getComputedStyle(current)
      const overflowY = style.overflowY
      const overflow = style.overflow
      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowY === 'hidden' ||
        overflowY === 'clip' ||
        overflow === 'hidden' ||
        overflow === 'clip'
      ) {
        return current
      }
      current = current.parentElement
    }

    return null
  }, [])

  useLayoutEffect(() => {
    const shell = tableShellRef.current
    const viewport = tableMetricsBodyVerticalViewportRef.current

    if (!shell || !viewport) return

    const viewportBottomGap = 0
    const minimumBodyHeight = 360

    const updateBodyMaxHeight = () => {
      const viewportTop = viewport.getBoundingClientRect().top
      const clippingAncestor = findClippingAncestor(shell)
      const clippingAncestorRect = clippingAncestor?.getBoundingClientRect()
      const clippingAncestorStyle = clippingAncestor ? window.getComputedStyle(clippingAncestor) : null
      const clippingPaddingBottom = clippingAncestorStyle ? Number.parseFloat(clippingAncestorStyle.paddingBottom) || 0 : 0
      const availableBottom = clippingAncestorRect
        ? clippingAncestorRect.bottom - clippingPaddingBottom
        : window.innerHeight
      const availableHeight = Math.floor(availableBottom - viewportTop - viewportBottomGap)
      setBodyMaxHeight(Math.max(minimumBodyHeight, availableHeight))
    }

    let frameId: number | null = null
    const scheduleUpdate = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      frameId = requestAnimationFrame(() => {
        updateBodyMaxHeight()
      })
    }

    const clippingAncestor = findClippingAncestor(shell)
    const observer = new ResizeObserver(() => {
      scheduleUpdate()
    })

    observer.observe(shell)
    observer.observe(viewport)
    if (clippingAncestor) {
      observer.observe(clippingAncestor)
    }
    window.addEventListener('resize', scheduleUpdate)
    clippingAncestor?.addEventListener('scroll', scheduleUpdate, { passive: true })
    scheduleUpdate()

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      observer.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      clippingAncestor?.removeEventListener('scroll', scheduleUpdate)
    }
  }, [findClippingAncestor, metricOrder.length, showLevels, visibleRows.length])

  useEffect(() => {
    const headerViewport = tableMetricsHeaderViewportRef.current
    const bodyViewport = tableMetricsBodyHorizontalViewportRef.current
    const horizontalScrollbar = tableHorizontalScrollbarRef.current
    const scrollContainers = [headerViewport, bodyViewport, horizontalScrollbar].filter(Boolean) as HTMLDivElement[]

    if (scrollContainers.length < 2) return

    let isSyncing = false
    let resetFrameId: number | null = null

    const syncScrollLeft = (source: HTMLDivElement) => {
      if (isSyncing) return

      isSyncing = true
      const nextScrollLeft = source.scrollLeft

      scrollContainers.forEach((element) => {
        if (element !== source && element.scrollLeft !== nextScrollLeft) {
          element.scrollLeft = nextScrollLeft
        }
      })

      resetFrameId = window.requestAnimationFrame(() => {
        isSyncing = false
      })
    }

    const listeners = scrollContainers.map((element) => {
      const handleScroll = () => {
        syncScrollLeft(element)
      }
      element.addEventListener('scroll', handleScroll, { passive: true })
      return { element, handleScroll }
    })

    syncScrollLeft(bodyViewport ?? scrollContainers[0])

    return () => {
      listeners.forEach(({ element, handleScroll }) => {
        element.removeEventListener('scroll', handleScroll)
      })
      if (resetFrameId !== null) {
        window.cancelAnimationFrame(resetFrameId)
      }
    }
  }, [metricOrder.length])

  useEffect(() => {
    const fixedViewport = tableFixedBodyViewportRef.current
    const metricsViewport = tableMetricsBodyVerticalViewportRef.current
    const scrollContainers = [fixedViewport, metricsViewport].filter(Boolean) as HTMLDivElement[]

    if (scrollContainers.length < 2) return

    let isSyncing = false
    let resetFrameId: number | null = null

    const syncScrollTop = (source: HTMLDivElement) => {
      if (isSyncing) return

      isSyncing = true
      const nextScrollTop = source.scrollTop

      scrollContainers.forEach((element) => {
        if (element !== source && element.scrollTop !== nextScrollTop) {
          element.scrollTop = nextScrollTop
        }
      })

      resetFrameId = window.requestAnimationFrame(() => {
        isSyncing = false
      })
    }

    const listeners = scrollContainers.map((element) => {
      const handleScroll = () => {
        syncScrollTop(element)
      }
      element.addEventListener('scroll', handleScroll, { passive: true })
      return { element, handleScroll }
    })

    syncScrollTop(metricsViewport ?? scrollContainers[0])

    return () => {
      listeners.forEach(({ element, handleScroll }) => {
        element.removeEventListener('scroll', handleScroll)
      })
      if (resetFrameId !== null) {
        window.cancelAnimationFrame(resetFrameId)
      }
    }
  }, [visibleRows.length])

  const renderBusinessUnitCell = (row: Row<EnrichedBizDataNode>) => {
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
        <span className="truncate font-medium text-[var(--color-text-strong)]">{row.original.node_name}</span>
      </div>
    )
  }

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
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div ref={tableShellRef} className="app-table-shell biz-data-table-shell">
          <div className="biz-data-table__header-row">
            <div className="biz-data-table__fixed-column">
              <table
                className="app-data-table app-data-table-compact biz-data-table__table"
                style={{ width: `${BUSINESS_UNIT_COLUMN_WIDTH}px` }}
              >
                <thead>
                  <tr>
                    <th
                      className="biz-data-table__sticky-header biz-data-table__sticky-corner !p-0"
                      style={{
                        width: `${BUSINESS_UNIT_COLUMN_WIDTH}px`,
                        minWidth: `${BUSINESS_UNIT_COLUMN_WIDTH}px`,
                        maxWidth: `${BUSINESS_UNIT_COLUMN_WIDTH}px`,
                      }}
                    >
                      <div className={`${HEADER_CONTENT_CLASS} items-center`}>
                        <span className="text-caption font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                          业务单元
                        </span>
                        <div className="text-caption font-medium text-transparent">占位</div>
                      </div>
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            <div ref={tableMetricsHeaderViewportRef} className="biz-data-table__header-viewport">
              <div className="biz-data-table__scroll-region" style={{ width: metricsTableWidth }}>
                <table
                  className="app-data-table app-data-table-compact biz-data-table__table"
                  style={{ width: metricsTableWidth }}
                >
                  <thead>
                    <tr>
                      <SortableContext
                        items={metricOrder}
                        strategy={horizontalListSortingStrategy}
                      >
                        {metricOrder.map((metric) => (
                          <th
                            key={metric}
                            className="biz-data-table__sticky-header !p-0"
                            style={{
                              width: `${METRIC_GROUP_WIDTH}px`,
                              minWidth: `${METRIC_GROUP_WIDTH}px`,
                              maxWidth: `${METRIC_GROUP_WIDTH}px`,
                            }}
                          >
                            <DraggableHeader id={metric}>
                              <div className="flex flex-col gap-1.5">
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
                </table>
              </div>
            </div>
          </div>

          <div
            ref={tableHorizontalScrollbarRef}
            className="biz-data-table__horizontal-scrollbar"
            aria-hidden="true"
          >
            <div
              className="biz-data-table__horizontal-scrollbar-content"
              style={{ width: metricsTableWidth }}
            />
          </div>

          <div className="biz-data-table__body-row">
            <div
              ref={tableFixedBodyViewportRef}
              className="biz-data-table__fixed-body-viewport biz-data-table__vertical-viewport biz-data-table__fixed-column"
              style={bodyMaxHeight ? { height: `${bodyMaxHeight}px`, maxHeight: `${bodyMaxHeight}px` } : undefined}
            >
              <table
                className="app-data-table app-data-table-compact biz-data-table__table"
                style={{ width: `${BUSINESS_UNIT_COLUMN_WIDTH}px` }}
              >
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td
                        className="biz-data-table__business-cell align-middle"
                        style={{
                          width: `${BUSINESS_UNIT_COLUMN_WIDTH}px`,
                          minWidth: `${BUSINESS_UNIT_COLUMN_WIDTH}px`,
                          maxWidth: `${BUSINESS_UNIT_COLUMN_WIDTH}px`,
                        }}
                      >
                        {renderBusinessUnitCell(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              ref={tableMetricsBodyHorizontalViewportRef}
              className="biz-data-table__body-viewport biz-data-table__metrics-pane"
            >
              <div className="biz-data-table__scroll-region" style={{ width: metricsTableWidth }}>
                <div
                  ref={tableMetricsBodyVerticalViewportRef}
                  className="biz-data-table__vertical-viewport"
                  style={bodyMaxHeight ? { height: `${bodyMaxHeight}px`, maxHeight: `${bodyMaxHeight}px` } : undefined}
                >
                <table
                  className="app-data-table app-data-table-compact biz-data-table__table"
                  style={{ width: metricsTableWidth }}
                >
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.id}>
                        {metricOrder.map((metric) => {
                          const actual = row.original.metrics[metric]?.actual ?? null
                          const budget = row.original.metrics[metric]?.[budgetField] ?? null
                          const rawCompletionRate = row.original.metrics[metric]?.[completionField] ?? null
                          const displayCompletionRate = getMetricDisplayCompletionRate(metric, actual, budget, rawCompletionRate)
                          const thresholds = getNodeThresholds()
                          const alertLevel = getAlertLevelByMetric(metric, actual, budget, rawCompletionRate, thresholds)
                          const colorClass = getAlertColorClass(alertLevel)
                          const bgClass = getAlertBgClass(alertLevel)
                          const borderClass = getAlertBorderClass(alertLevel)
                          const helperText = getMetricAlertRuleText(metric, budget)

                          return (
                            <td
                              key={metric}
                              className="border-r border-[rgba(148,163,184,0.08)] last:border-r-0"
                              style={{
                                width: `${METRIC_GROUP_WIDTH}px`,
                                minWidth: `${METRIC_GROUP_WIDTH}px`,
                                maxWidth: `${METRIC_GROUP_WIDTH}px`,
                              }}
                            >
                              <div className="grid h-full grid-cols-3 items-center gap-1.5 px-3">
                                <div className="text-right">
                                  <span className="font-medium text-[var(--color-text-strong)]">{fmt(actual)}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[var(--color-text-muted)]">{fmt(budget)}</span>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg border ${bgClass} ${borderClass}`}
                                    title={helperText ?? undefined}
                                  >
                                    <span className={`font-semibold ${colorClass}`}>
                                      {fmtPct(displayCompletionRate)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  )
}
