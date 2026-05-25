import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table'
import { AlertTriangle, ChevronDown, ChevronRight, Flag } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { loadStrategyBudgetPlan } from '../services/bizDataService'
import type { EduStrategyBudgetPlan } from '../types'
import { fmt } from '@/shared/lib/format'
import {
  buildPivotTreeRows,
  formatPivotDelta,
  formatPivotValue,
  getRowTone,
  getTrendRows,
  type PivotMetric,
  type StrategyPivotTreeRow,
  type TrendGroup,
} from './strategyPlanModel'

function buildDefaultExpanded(rows: StrategyPivotTreeRow[]): ExpandedState {
  const expanded: ExpandedState = {}

  rows.forEach((node) => {
    if (node.children.length > 0) {
      expanded[node.id] = true
    }
  })
  return expanded
}

export function StrategyPlanView() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<EduStrategyBudgetPlan[]>([])
  const [trendGroup, setTrendGroup] = useState<TrendGroup>('overall_total')
  const [pivotMetric, setPivotMetric] = useState<PivotMetric>('revenue')
  const [pivotExpanded, setPivotExpanded] = useState<ExpandedState>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const nextRows = await loadStrategyBudgetPlan()
        setRows(nextRows)
      } catch (error) {
        console.error('[StrategyPlan] Failed to load data:', error)
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const trendRows = useMemo(() => getTrendRows(rows, trendGroup), [rows, trendGroup])
  const note = rows[0]?.source_note
  const pivotYears = useMemo(
    () => [...new Set(rows.map((row) => row.plan_year))].sort((a, b) => a - b).map(String),
    [rows],
  )

  const pivotRows = useMemo<StrategyPivotTreeRow[]>(() => buildPivotTreeRows(rows, pivotMetric), [rows, pivotMetric])

  useEffect(() => {
    setPivotExpanded(buildDefaultExpanded(pivotRows))
  }, [pivotRows])

  const pivotColumns = useMemo<ColumnDef<StrategyPivotTreeRow>[]>(() => {
    const staticColumns: ColumnDef<StrategyPivotTreeRow>[] = [
      {
        accessorKey: 'label',
        header: '节点',
        cell: ({ row }) => (
          <div
            className="strategy-plan-table__line-cell strategy-plan-tree__cell"
            style={{ paddingLeft: `${row.depth * 18}px` }}
          >
            <div className="strategy-plan-tree__label-row">
              {row.getCanExpand() ? (
                <button
                  type="button"
                  className="strategy-plan-tree__toggle"
                  onClick={row.getToggleExpandedHandler()}
                  aria-label={row.getIsExpanded() ? '收起节点' : '展开节点'}
                >
                  {row.getIsExpanded() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="strategy-plan-tree__toggle strategy-plan-tree__toggle-placeholder" />
              )}
              <div className="strategy-plan-tree__content">
                <div className="font-medium text-[var(--color-text-strong)]">{row.original.label}</div>
                <span className={`strategy-plan-pill strategy-plan-pill-${getRowTone(row.original.lineRole)}`}>
                  {row.original.lineRole === 'detail'
                    ? '明细'
                    : row.original.lineRole === 'subtotal'
                      ? '小计'
                      : row.original.lineRole === 'total'
                        ? '合计'
                        : row.original.strategyGroupCn}
                </span>
              </div>
            </div>
          </div>
        ),
      },
    ]

    const yearColumns: ColumnDef<StrategyPivotTreeRow>[] = pivotYears.map((year, index) => {
      const previousYear = index > 0 ? pivotYears[index - 1] : null

      return {
        id: year,
        header: year,
        accessorFn: (row) => row.values[year] ?? null,
        cell: ({ row }) => {
          const current = row.original.values[year] ?? null
          const previous = previousYear ? (row.original.values[previousYear] ?? null) : null
          const delta = formatPivotDelta(current, previous)

          return (
            <div className="strategy-plan-pivot__value">
              <div className="strategy-plan-pivot__value-main">
                {formatPivotValue(current)}
              </div>
              <div className="strategy-plan-pivot__value-sub">
                {delta ?? '—'}
              </div>
            </div>
          )
        },
      }
    })

    return [...staticColumns, ...yearColumns]
  }, [pivotYears])

  const pivotTable = useReactTable({
    data: pivotRows,
    columns: pivotColumns,
    state: {
      expanded: pivotExpanded,
    },
    onExpandedChange: setPivotExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children,
  })

  if (loading) {
    return (
      <div className="biz-content-area">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] mx-auto mb-3"></div>
            <div className="text-caption text-[var(--color-text-muted)]">规划数据加载中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="biz-content-area">
        <div className="app-empty-state">
          <AlertTriangle size={32} className="text-warning-700 opacity-60" />
          <div className="text-[var(--color-text-strong)] font-medium text-body">暂无规划数据</div>
          <div className="text-caption text-[var(--color-text-muted)]">
            请检查 `edu_strategy_budget_plan` 表是否已导入
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="strategy-plan-view">
      <section className="app-section-card strategy-plan-chart-card">
        <div className="app-table-toolbar strategy-plan-chart-card__header">
          <div>
            <div className="app-table-title">五年趋势</div>
          </div>
          <div className="strategy-plan-trend-switch" role="tablist" aria-label="趋势图分组切换">
            <button
              type="button"
              className={['strategy-plan-trend-switch__item', trendGroup === 'overall_total' ? 'is-active' : ''].join(' ').trim()}
              onClick={() => setTrendGroup('overall_total')}
            >
              合计
            </button>
            <button
              type="button"
              className={['strategy-plan-trend-switch__item', trendGroup === 'base_business' ? 'is-active' : ''].join(' ').trim()}
              onClick={() => setTrendGroup('base_business')}
            >
              基本盘
            </button>
            <button
              type="button"
              className={['strategy-plan-trend-switch__item', trendGroup === 'growth_engine' ? 'is-active' : ''].join(' ').trim()}
              onClick={() => setTrendGroup('growth_engine')}
            >
              增长极
            </button>
          </div>
        </div>
        <div className="strategy-plan-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendRows} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.24)" />
              <XAxis dataKey="year" stroke="rgba(100, 116, 139, 0.9)" tickLine={false} axisLine={false} />
              <YAxis yAxisId="amount" stroke="rgba(100, 116, 139, 0.9)" tickLine={false} axisLine={false} tickFormatter={(value) => fmt(Number(value))} />
              <Tooltip
                formatter={(value, name) => {
                  const numericValue = typeof value === 'number' ? value : null
                  return [fmt(numericValue), name]
                }}
                contentStyle={{
                  borderRadius: '16px',
                  border: '1px solid rgba(148,163,184,0.2)',
                  background: 'rgba(255,255,255,0.94)',
                  boxShadow: '0 16px 40px rgba(15,23,42,0.12)',
                }}
              />
              <Legend />
              <Line yAxisId="amount" type="monotone" dataKey="revenue" name="营收" stroke="#5f7fbc" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="amount" type="monotone" dataKey="profit" name="利润" stroke="#0f9f6e" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="app-table-shell strategy-plan-table-shell strategy-plan-pivot-shell">
        <div className="app-table-toolbar">
          <div>
            <div className="app-table-title">按年份横向透视</div>
            <div className="app-table-meta">切换单一指标后，以 合计 → 小计 → 明细 的树状结构展开，并展示相较上一年的变化</div>
          </div>
          <div className="strategy-plan-trend-switch" role="tablist" aria-label="透视表指标切换">
            <button
              type="button"
              className={['strategy-plan-trend-switch__item', pivotMetric === 'revenue' ? 'is-active' : ''].join(' ').trim()}
              onClick={() => setPivotMetric('revenue')}
            >
              营收
            </button>
            <button
              type="button"
              className={['strategy-plan-trend-switch__item', pivotMetric === 'profit' ? 'is-active' : ''].join(' ').trim()}
              onClick={() => setPivotMetric('profit')}
            >
              利润
            </button>
          </div>
        </div>
        <div className="app-table-scroll strategy-plan-pivot-scroll">
          <table className="app-data-table strategy-plan-pivot-table">
            <thead>
              {pivotTable.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                    <th
                      key={header.id}
                      className={index < 1 ? 'strategy-plan-pivot-table__sticky-header' : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {pivotTable.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={[
                    row.original.lineRole !== 'detail' ? 'app-data-row-emphasis' : '',
                    `strategy-plan-row-${getRowTone(row.original.lineRole)}`,
                  ].join(' ').trim()}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <td
                      key={cell.id}
                      className={index < 1 ? `strategy-plan-pivot-table__sticky-cell strategy-plan-pivot-table__sticky-cell-${index}` : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {note ? (
        <section className="app-section-card app-section-card-muted strategy-plan-note">
          <div className="strategy-plan-note__icon">
            <Flag size={16} />
          </div>
          <p className="text-caption text-[var(--color-text-muted)]">{note}</p>
        </section>
      ) : null}
    </div>
  )
}
