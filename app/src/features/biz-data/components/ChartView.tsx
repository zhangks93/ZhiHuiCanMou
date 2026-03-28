import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ChevronRight } from 'lucide-react'
import { METRIC_LABELS, CHART_COLORS } from '@/shared/lib/constants'
import type { EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import { buildTreeWithAggregation, getChildren } from '@/features/biz-data/services/bizDataService'
import { fmt } from '@/shared/lib/format'

interface ChartViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
}

interface DrillDownLevel {
  node: EnrichedBizDataNode | null
  label: string
}

export function ChartView({ nodes, reportType, selectedMetrics }: ChartViewProps) {
  const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'

  const allNodesWithAggregation = useMemo(() => {
    return buildTreeWithAggregation(nodes)
  }, [nodes])

  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([
    { node: null, label: '全部' }
  ])

  const currentLevelNodes = useMemo(() => {
    const currentLevel = drillDownPath[drillDownPath.length - 1]

    if (!currentLevel.node) {
      return allNodesWithAggregation.filter(n => {
        const { level_1, level_2 } = n.orgHierarchy
        return level_1 && !level_2 && n.node_name === level_1
      }).sort((a, b) => a.sort_order - b.sort_order)
    }

    return getChildren(currentLevel.node, allNodesWithAggregation)
  }, [drillDownPath, allNodesWithAggregation])

  const chartData = useMemo(() => {
    return currentLevelNodes.map(node => {
      const dataPoint: Record<string, string | number | null> = {
        name: node.node_name,
      }

      selectedMetrics.forEach(metric => {
        const metricData = node.metrics[metric]
        dataPoint[`${metric}_actual`] = metricData?.actual ?? null
        dataPoint[`${metric}_budget`] = metricData?.[budgetField] ?? null
      })

      return dataPoint
    })
  }, [currentLevelNodes, selectedMetrics, budgetField])

  const handleBarClick = (data: any) => {
    if (!data || typeof data.name !== 'string') return

    const clickedNode = currentLevelNodes.find(n => n.node_name === data.name)
    if (!clickedNode) return

    const children = getChildren(clickedNode, allNodesWithAggregation)

    if (children.length > 0) {
      setDrillDownPath(prev => [...prev, {
        node: clickedNode,
        label: clickedNode.node_name
      }])
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    setDrillDownPath(prev => prev.slice(0, index + 1))
  }

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
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 text-xs">
        {drillDownPath.map((level, index) => (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight size={12} className="text-[var(--color-text-muted)]" />}
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className={`
                px-2 py-1 rounded-lg transition-all duration-150
                ${index === drillDownPath.length - 1
                  ? 'bg-[var(--color-accent)] text-white font-medium shadow-[0_2px_8px_rgba(37,99,235,0.25)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)]'
                }
              `}
            >
              {level.label}
            </button>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="biz-content-area">
        {currentLevelNodes.length === 0 ? (
          <div className="app-empty-state">
            <p className="text-xs">暂无数据</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={460}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={120}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip
                formatter={(value: unknown) => fmt(value as number)}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border)',
                  background: 'rgba(255,255,255,0.96)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {selectedMetrics.flatMap((metric, idx) => {
                const baseColor = CHART_COLORS[idx % CHART_COLORS.length]
                return [
                  <Bar
                    key={`${metric}_actual`}
                    dataKey={`${metric}_actual`}
                    fill={baseColor}
                    name={`${METRIC_LABELS[metric]} 实际`}
                    onClick={handleBarClick}
                    cursor="pointer"
                    radius={[3, 3, 0, 0]}
                  />,
                  <Bar
                    key={`${metric}_budget`}
                    dataKey={`${metric}_budget`}
                    fill={`${baseColor}55`}
                    name={`${METRIC_LABELS[metric]} 预算`}
                    onClick={handleBarClick}
                    cursor="pointer"
                    radius={[3, 3, 0, 0]}
                  />,
                ]
              })}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hint */}
      {currentLevelNodes.length > 0 && (
        <div className="text-[10px] text-[var(--color-text-muted)] text-center opacity-60">
          点击柱状图下钻查看下级数据
        </div>
      )}
    </div>
  )
}
