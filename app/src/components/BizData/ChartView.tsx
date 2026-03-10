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
import type { EnrichedBizDataNode, MetricCategory } from '@/lib/supabase'
import { METRIC_LABELS, CHART_COLORS } from '@/lib/constants'
import { buildTreeWithAggregation, getChildren } from '@/services/bizDataService'
import { fmt } from '@/lib/format'

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

  // Build complete tree with aggregation (reuse from TableView)
  const allNodesWithAggregation = useMemo(() => {
    return buildTreeWithAggregation(nodes)
  }, [nodes])

  // Drill-down navigation state
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([
    { node: null, label: '全部' }
  ])

  // Get current level nodes
  const currentLevelNodes = useMemo(() => {
    const currentLevel = drillDownPath[drillDownPath.length - 1]

    if (!currentLevel.node) {
      // Root level: show all level_1 nodes
      return allNodesWithAggregation.filter(n => {
        const { level_1, level_2, level_3 } = n.orgHierarchy
        return level_1 && !level_2 && !level_3 && n.node_name === level_1
      }).sort((a, b) => a.sort_order - b.sort_order)
    }

    // Get children of current node (reuse from TableView)
    return getChildren(currentLevel.node, allNodesWithAggregation)
  }, [drillDownPath, allNodesWithAggregation])

  // Prepare chart data
  const chartData = useMemo(() => {
    return currentLevelNodes.map(node => {
      const dataPoint: Record<string, string | number | null> = {
        name: node.node_name,
        _nodeData: node, // Store node reference for drill-down
      }

      selectedMetrics.forEach(metric => {
        const metricData = node.metrics[metric]
        dataPoint[`${metric}_actual`] = metricData?.actual ?? null
        dataPoint[`${metric}_budget`] = metricData?.[budgetField] ?? null
      })

      return dataPoint
    })
  }, [currentLevelNodes, selectedMetrics, budgetField])

  // Handle bar click for drill-down
  const handleBarClick = (data: { _nodeData?: EnrichedBizDataNode }) => {
    if (!data || !data._nodeData) return

    const clickedNode = data._nodeData
    const children = getChildren(clickedNode, allNodesWithAggregation)

    // Only drill down if node has children
    if (children.length > 0) {
      setDrillDownPath(prev => [...prev, {
        node: clickedNode,
        label: clickedNode.node_name
      }])
    }
  }

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (index: number) => {
    setDrillDownPath(prev => prev.slice(0, index + 1))
  }

  if (selectedMetrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">请至少选择一个指标</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm">
        {drillDownPath.map((level, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight size={14} className="text-gray-400" />}
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className={`
                px-3 py-1.5 rounded-md transition-colors
                ${index === drillDownPath.length - 1
                  ? 'bg-primary text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {level.label}
            </button>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        {currentLevelNodes.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-gray-500">
            暂无数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={120}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: unknown) => fmt(value as number)}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              {/* Render bars for each metric: actual and budget */}
              {selectedMetrics.flatMap((metric, idx) => {
                const baseColor = CHART_COLORS[idx % CHART_COLORS.length]
                return [
                  <Bar
                    key={`${metric}_actual`}
                    dataKey={`${metric}_actual`}
                    fill={baseColor}
                    name={`${METRIC_LABELS[metric]} - 实际`}
                    onClick={handleBarClick}
                    cursor="pointer"
                  />,
                  <Bar
                    key={`${metric}_budget`}
                    dataKey={`${metric}_budget`}
                    fill={`${baseColor}80`}
                    name={`${METRIC_LABELS[metric]} - 预算`}
                    onClick={handleBarClick}
                    cursor="pointer"
                  />
                ]
              })}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hint */}
      {currentLevelNodes.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          点击柱状图可以下钻查看下级数据
        </div>
      )}
    </div>
  )
}
