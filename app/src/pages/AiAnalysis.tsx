import { PageTitle } from '@/components/ui/PageTitle'
import { Sparkles } from 'lucide-react'

const insights = [
  {
    type: 'positive',
    title: '优势业务：数智零售线上 —— 可深度挖掘',
    desc: '当前达成率95%，盈利能力领先。建议在 Q3 推进 2~3 个同类学校园区线上零售项目落地，预计可增量营收约 400 万元。',
  },
  {
    type: 'alert',
    title: '缺口预警：北区餐饮配送 · 当前缺口 166 万 / 月',
    desc: '按当前趋势，全年营收缺口约 996 万元。若通过商机转化弥补，需在 Q3 签约 A 级商机至少 2 单（合同体量 ≥ 500 万/单）；当前管道中可优先推进：广东某高校配餐（800万，A级）、深圳科技园项目（620万，A级）。',
  },
  {
    type: 'warning',
    title: '商机转化路径建议',
    desc: '初期洽谈阶段商机过多（5项），中后期推进力度不足。建议重点资源向「拟标阶段」4项倾斜，预计90天内可触发2~3单签约。',
  },
  {
    type: 'info',
    title: '利润优化空间',
    desc: '学校食堂特色餐利润率仅65%（红色预警），建议评估食材成本结构并与营养配餐供应商重新谈判，目标将利润率提升至75%以上，可增加约 8 万元/月利润贡献。',
  },
]

const insightStyles: Record<string, string> = {
  positive: 'border-l-success bg-gray-50',
  alert: 'border-l-error bg-gray-50',
  warning: 'border-l-warning bg-gray-50',
  info: 'border-l-primary-500 bg-gray-50',
}

export function AiAnalysis() {
  return (
    <>
      <PageTitle breadcrumb="工具与分析 / 智能分析" title="智能分析" />

      <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={18} strokeWidth={1.5} className="text-gray-600" />
          <h3 className="font-medium text-gray-900">经营 × 商机智能匹配分析（本月）</h3>
        </div>
        <div className="space-y-4">
          {insights.map((i, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-l-[3px] ${insightStyles[i.type]}`}
            >
              <div className="font-medium text-gray-900 mb-1">{i.title}</div>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {i.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
