import { PageTitle } from '@/components/ui/PageTitle'
import { Trophy } from 'lucide-react'

const competitors = [
  { rank: 1, name: 'XX大型餐饮集团', area: '配送 · 餐饮 · 覆盖：广东全省', tag: '重点关注', tagStyle: 'bg-error-100 text-error-700' },
  { rank: 2, name: 'YY校园服务公司', area: '线上零售 · 覆盖：珠三角', tag: '关注', tagStyle: 'bg-warning-100 text-warning-700' },
  { rank: 3, name: 'ZZ区域后勤外包', area: '餐饮运营 · 覆盖：粤东', tag: '一般', tagStyle: 'bg-gray-200 text-gray-700' },
]

const rankStyles = ['bg-warning-100 text-warning-700', 'bg-gray-200 text-gray-700', 'bg-gray-100 text-gray-600']

export function Competitor() {
  return (
    <>
      <PageTitle breadcrumb="业务管理 / 竞对档案" title="竞对档案" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">竞争对手排名（基础教育赛道）</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {competitors.map((c, i) => (
              <div key={c.name} className="flex items-center gap-4 py-4 first:pt-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${rankStyles[i]}`}>
                  {c.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-600">{c.area}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.tagStyle}`}>{c.tag}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">XX大型餐饮集团 · 档案详情</h3>
          </div>
          <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
            <div>
              <strong className="text-gray-900">经营模式：</strong>
              直营 + 加盟，重点覆盖 K12 学校食堂配餐
            </div>
            <div>
              <strong className="text-gray-900">优势：</strong>
              资金充裕、品牌知名度高、规模化采购成本低
            </div>
            <div>
              <strong className="text-gray-900">短板：</strong>
              服务灵活性差、定制化能力弱、高管层变动频繁
            </div>
            <div>
              <strong className="text-gray-900">近期动向：</strong>
              2025年 Q1 新签深圳项目 3 个，正在扩充团队
            </div>
            <span className="inline-block text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">最后更新：2025-06-01</span>
          </div>
        </div>
      </div>
    </>
  )
}
