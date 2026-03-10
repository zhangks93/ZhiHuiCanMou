import { BarChart3 } from 'lucide-react'
import type { EnrichedBizDataNode } from '@/lib/supabase'

interface ChartViewProps {
  nodes: EnrichedBizDataNode[]
  reportType: 'fone' | 'tuwei' | 'comparison'
}

export function ChartView({ nodes, reportType }: ChartViewProps) {
  const reportTypeLabel = reportType === 'fone' ? '年初预算' : reportType === 'tuwei' ? '突围考核' : '对比视图'

  return (
    <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <BarChart3 size={64} className="text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-700 mb-2">图表视图</h3>
      <p className="text-sm text-gray-500 text-center max-w-md">
        图表可视化功能即将推出<br />
        将支持柱状图、折线图、饼图等多种展示形式
      </p>
      <div className="mt-4 text-xs text-gray-400">
        当前数据节点: {nodes.length} | 报表类型: {reportTypeLabel}
      </div>
    </div>
  )
}
