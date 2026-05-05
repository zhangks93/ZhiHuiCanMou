import { useMemo, type Dispatch, type SetStateAction } from 'react'
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
import { METRIC_LABELS, CHART_COLORS } from '@/shared/lib/constants'
import type { EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import { buildTreeWithAggregation, getChildren } from '@/features/biz-data/services/bizDataService'
import { fmt } from '@/shared/lib/format'

interface ChartViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei'
  selectedMetrics: MetricCategory[]
  drillDownPath: DrillDownLevel[]
  onDrillDownPathChange: Dispatch<SetStateAction<DrillDownLevel[]>>
}

export interface DrillDownLevel {
  node: EnrichedBizDataNode | null
  label: string
}

export function ChartView({
  nodes,
  reportType,
  selectedMetrics,
  drillDownPath,
  onDrillDownPathChange,
}: ChartViewProps) {
  const budgetField = reportType === 'fone' ? 'budget_fone' : 'budget_tuwei'
  const actualField = reportType === 'fone' ? 'actual_fone' : 'actual_tuwei'
  const captionFont = 'var(--font-size-caption)'
  const bodyFont = 'var(--font-size-body)'
  const bodyFontFamily = 'var(--font-family-body)'

  const allNodesWithAggregation = useMemo(() => {
    return buildTreeWithAggregation(nodes)
  }, [nodes])

  const currentLevelNodes = useMemo(() => {
    const currentLevel = drillDownPath[drillDownPath.length - 1]

    if (!currentLevel.node) {
      return allNodesWithAggregation.filter((node) => {
        const { level_1, level_2 } = node.orgHierarchy
        return level_1 && !level_2 && node.node_name === level_1
      }).sort((a, b) => a.sort_order - b.sort_order)
    }

    return getChildren(currentLevel.node, allNodesWithAggregation)
  }, [drillDownPath, allNodesWithAggregation])

  const chartData = useMemo(() => {
    return currentLevelNodes.map((node) => {
      const dataPoint: Record<string, string | number | null> = {
        name: node.node_name,
      }

      selectedMetrics.forEach((metric) => {
        const metricData = node.metrics[metric]
        dataPoint[`${metric}_actual`] = metricData?.[actualField] ?? metricData?.actual ?? null
        dataPoint[`${metric}_budget`] = metricData?.[budgetField] ?? null
      })

      return dataPoint
    })
  }, [currentLevelNodes, selectedMetrics, budgetField, actualField])

  const handleBarClick = (data: { name?: string } | undefined) => {
    if (!data?.name) return

    const clickedNode = currentLevelNodes.find((node) => node.node_name === data.name)
    if (!clickedNode) return

    const children = getChildren(clickedNode, allNodesWithAggregation)
    if (children.length === 0) return

    onDrillDownPathChange((prev) => [
      ...prev,
      {
        node: clickedNode,
        label: clickedNode.node_name,
      },
    ])
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
    <div className="space-y-3">
      <div className="biz-content-area">
        {currentLevelNodes.length === 0 ? (
          <div className="app-empty-state">
            <p className="text-caption">暂无数据</p>
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
                tick={{ fontSize: captionFont, fontFamily: bodyFontFamily, fill: 'var(--color-text-muted)' }}
              />
              <YAxis tick={{ fontSize: captionFont, fontFamily: bodyFontFamily, fill: 'var(--color-text-muted)' }} />
              <Tooltip
                formatter={(value: unknown) => fmt(value as number)}
                contentStyle={{
                  fontSize: bodyFont,
                  fontFamily: bodyFontFamily,
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border)',
                  background: 'rgba(255,255,255,0.96)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: captionFont, fontFamily: bodyFontFamily }} />

              {selectedMetrics.flatMap((metric, index) => {
                const baseColor = CHART_COLORS[index % CHART_COLORS.length]
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

      {currentLevelNodes.length > 0 && (
        <div className="text-caption text-[var(--color-text-muted)] text-center opacity-60">
          点击柱状图下钻查看下级数据
        </div>
      )}
    </div>
  )
}
