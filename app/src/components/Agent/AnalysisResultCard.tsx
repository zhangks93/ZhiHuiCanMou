// Analysis Result Card - 展示经营数据分析结果

import type { SkillResult } from '@/services/agent/types'

interface AnalysisResultCardProps {
  result: SkillResult
}

export function AnalysisResultCard({ result }: AnalysisResultCardProps) {
  if (!result.success || !result.data) {
    return null
  }

  const { data } = result

  // 格式化数字
  const fmt = (v: number | null | undefined, suffix = '') => {
    if (v == null) return '-'
    return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + suffix
  }

  const fmtPct = (v: number | null | undefined) => {
    if (v == null) return '-'
    return (v * 100).toFixed(1) + '%'
  }

  // 总览分析
  if (data.overall && data.centers) {
    return (
      <div className="mt-4 space-y-4">
        {/* 整体指标卡片 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs text-blue-600 font-medium mb-1">总营收</div>
            <div className="text-2xl font-bold text-blue-900">
              {fmt(data.overall.revenue.actual, '万')}
            </div>
            <div className="text-xs text-blue-600 mt-2">
              预算: {fmt(data.overall.revenue.budget, '万')} | 达成率: {fmtPct(data.overall.revenue.completion)}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-xs text-green-600 font-medium mb-1">总利润</div>
            <div className="text-2xl font-bold text-green-900">
              {fmt(data.overall.profit.actual, '万')}
            </div>
            <div className="text-xs text-green-600 mt-2">
              预算: {fmt(data.overall.profit.budget, '万')} | 达成率: {fmtPct(data.overall.profit.completion)}
            </div>
          </div>
        </div>

        {/* 中心对比表格 */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">各中心表现</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">中心</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">营收(万)</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">达成率</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">利润(万)</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">毛利率</th>
                </tr>
              </thead>
              <tbody>
                {data.centers.map((center: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-800">{center.name}</td>
                    <td className="py-2 px-4 text-right text-gray-700">{fmt(center.revenue.actual)}</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`font-medium ${
                        (center.revenue.completion || 0) >= 0.9 ? 'text-green-600' :
                        (center.revenue.completion || 0) >= 0.8 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {fmtPct(center.revenue.completion)}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-gray-700">{fmt(center.profit.actual)}</td>
                    <td className="py-2 px-4 text-right text-gray-700">{fmtPct(center.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 对比分析
  if (data.comparison && data.insights) {
    return (
      <div className="mt-4 space-y-4">
        {/* 洞察卡片 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-xs text-green-600 font-medium mb-1">表现最佳</div>
            <div className="text-lg font-bold text-green-900">{data.insights.best.name}</div>
            <div className="text-xs text-green-600 mt-1">
              营收达成率: {fmtPct(data.insights.best.revenueCompletion)}
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-xs text-orange-600 font-medium mb-1">需要关注</div>
            <div className="text-lg font-bold text-orange-900">{data.insights.worst.name}</div>
            <div className="text-xs text-orange-600 mt-1">
              营收达成率: {fmtPct(data.insights.worst.revenueCompletion)}
            </div>
          </div>
        </div>

        {/* 对比表格 */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">中心对比排名</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">排名</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">中心</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">营收达成率</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">利润达成率</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">毛利率</th>
                </tr>
              </thead>
              <tbody>
                {data.comparison.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-600">#{idx + 1}</td>
                    <td className="py-2 px-4 text-gray-800 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`font-medium ${
                        item.revenueCompletion >= 0.9 ? 'text-green-600' :
                        item.revenueCompletion >= 0.8 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {fmtPct(item.revenueCompletion)}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-gray-700">{fmtPct(item.profitCompletion)}</td>
                    <td className="py-2 px-4 text-right text-gray-700">{fmtPct(item.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 下钻分析
  if (data.nodeName && data.metrics) {
    return (
      <div className="mt-4 space-y-4">
        {/* 节点信息 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-900 mb-2">{data.nodeName}</div>
          {data.hierarchy && (
            <div className="text-xs text-blue-600">
              {data.hierarchy.level_1} {data.hierarchy.level_2 && `> ${data.hierarchy.level_2}`} {data.hierarchy.level_3 && `> ${data.hierarchy.level_3}`}
            </div>
          )}
        </div>

        {/* 关键指标 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-600 mb-1">营收</div>
            <div className="text-xl font-bold text-gray-900">{fmt(data.metrics.revenue.actual, '万')}</div>
            <div className="text-xs text-gray-600 mt-1">
              预算: {fmt(data.metrics.revenue.budget, '万')} | 达成: {fmtPct(data.metrics.revenue.completion)}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-600 mb-1">利润</div>
            <div className="text-xl font-bold text-gray-900">{fmt(data.metrics.profit.actual, '万')}</div>
            <div className="text-xs text-gray-600 mt-1">
              预算: {fmt(data.metrics.profit.budget, '万')} | 达成: {fmtPct(data.metrics.profit.completion)}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-600 mb-1">毛利率</div>
            <div className="text-xl font-bold text-gray-900">{fmtPct(data.metrics.margin.actual)}</div>
            <div className="text-xs text-gray-600 mt-1">
              预算: {fmtPct(data.metrics.margin.budget)}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-600 mb-1">人力成本率</div>
            <div className="text-xl font-bold text-gray-900">{fmtPct(data.metrics.laborCostRate.actual)}</div>
            <div className="text-xs text-gray-600 mt-1">
              预算: {fmtPct(data.metrics.laborCostRate.budget)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 默认：显示原始数据
  return (
    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
      <pre className="text-xs text-gray-700 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
