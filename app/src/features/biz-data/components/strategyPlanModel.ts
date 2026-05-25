import type { EduStrategyBudgetPlan } from '@/features/biz-data/types'
import { fmt } from '@/shared/lib/format'

export interface StrategyPivotTreeRow {
  id: string
  label: string
  strategyGroupCn: string
  lineRole: EduStrategyBudgetPlan['line_role']
  sortOrder: number
  values: Record<string, number | null>
  children: StrategyPivotTreeRow[]
}

export type TrendGroup = 'overall_total' | 'base_business' | 'growth_engine'
export type PivotMetric = 'revenue' | 'profit'

export function formatPivotValue(value: number | null) {
  return fmt(value)
}

export function formatPivotDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null

  const delta = current - previous
  const sign = delta > 0 ? '+' : ''
  return `${sign}${fmt(delta)}`
}

export function getRowTone(lineRole: EduStrategyBudgetPlan['line_role']) {
  if (lineRole === 'total') return 'danger'
  if (lineRole === 'subtotal') return 'accent'
  if (lineRole === 'kpi') return 'success'
  return 'neutral'
}

export function getTrendRows(rows: EduStrategyBudgetPlan[], trendGroup: TrendGroup) {
  const years = [...new Set(rows.map((row) => row.plan_year))].sort((a, b) => a - b)

  return years.map((year) => {
    const matchedRows = rows.filter((row) => {
      if (row.plan_year !== year) return false

      if (trendGroup === 'overall_total') {
        return row.line_role === 'total'
      }

      return row.strategy_group === trendGroup && row.line_role === 'subtotal'
    })

    const revenue = matchedRows.find((row) => row.metric_code === 'revenue')?.value ?? null
    const profit = matchedRows.find((row) => row.metric_code === 'profit')?.value ?? null

    return {
      year: String(year),
      revenue,
      profit,
    }
  })
}

export function buildPivotTreeRows(rows: EduStrategyBudgetPlan[], metric: PivotMetric): StrategyPivotTreeRow[] {
  const amountRows = rows
    .filter((row) => row.metric_code === metric && row.line_role !== 'kpi')
    .sort((a, b) => a.sort_order - b.sort_order)

  const createNode = (row: EduStrategyBudgetPlan): StrategyPivotTreeRow => ({
    id: `${row.line_label}|||${row.line_role}`,
    label: row.line_label,
    strategyGroupCn: row.strategy_group_cn,
    lineRole: row.line_role,
    sortOrder: row.sort_order,
    values: {},
    children: [],
  })

  const nodeMap = new Map<string, StrategyPivotTreeRow>()
  const metaRowMap = new Map<string, EduStrategyBudgetPlan>()

  amountRows.forEach((row) => {
    const key = `${row.line_label}|||${row.line_role}`
    if (!nodeMap.has(key)) {
      nodeMap.set(key, createNode(row))
      metaRowMap.set(key, row)
    }

    nodeMap.get(key)!.values[String(row.plan_year)] = row.value
  })

  const uniqueMetaRows = [...metaRowMap.entries()].map(([key, row]) => ({ key, row }))
  const detailRows = uniqueMetaRows.filter((entry) => entry.row.line_role === 'detail')
  const subtotalRows = uniqueMetaRows.filter((entry) => entry.row.line_role === 'subtotal')
  const totalRows = uniqueMetaRows.filter((entry) => entry.row.line_role === 'total')

  const detailNodesByGroup = new Map<string, StrategyPivotTreeRow[]>()
  detailRows.forEach(({ row, key }) => {
    const groupKey = row.strategy_group
    if (!detailNodesByGroup.has(groupKey)) detailNodesByGroup.set(groupKey, [])
    detailNodesByGroup.get(groupKey)!.push(nodeMap.get(key)!)
  })

  subtotalRows.forEach(({ row, key }) => {
    const subtotalNode = nodeMap.get(key)
    if (!subtotalNode) return
    const children = [...(detailNodesByGroup.get(row.strategy_group) ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
    subtotalNode.children = children
  })

  const roots: StrategyPivotTreeRow[] = []
  const totalNode = totalRows[0] ? nodeMap.get(totalRows[0].key) : null

  if (totalNode) {
    const subtotalNodes = subtotalRows
      .map(({ key }) => nodeMap.get(key))
      .filter((row): row is StrategyPivotTreeRow => !!row)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const subtotalGroups = new Set(subtotalRows.map(({ row }) => row.strategy_group))
    const orphanDetails = detailRows
      .filter(({ row }) => !subtotalGroups.has(row.strategy_group))
      .map(({ key }) => nodeMap.get(key))
      .filter((row): row is StrategyPivotTreeRow => !!row)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    totalNode.children = [...subtotalNodes, ...orphanDetails]
    roots.push(totalNode)
    return roots
  }

  return subtotalRows
    .map(({ key }) => nodeMap.get(key))
    .filter((row): row is StrategyPivotTreeRow => !!row)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
