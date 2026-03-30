import { Radar, Trophy } from 'lucide-react'

const competitors = [
  {
    rank: 1,
    name: 'XX大型餐饮集团',
    area: '配送 · 餐饮 · 覆盖：广东全省',
    tag: '重点关注',
    tagStyle: 'bg-error-100 text-error-700',
  },
  {
    rank: 2,
    name: 'YY校园服务公司',
    area: '线上零售 · 覆盖：珠三角',
    tag: '关注',
    tagStyle: 'bg-warning-100 text-warning-700',
  },
  {
    rank: 3,
    name: 'ZZ区域后勤外包',
    area: '餐饮运营 · 覆盖：粤东',
    tag: '一般',
    tagStyle: 'bg-gray-200 text-gray-700',
  },
]

const rankStyles = ['bg-warning-100 text-warning-700', 'bg-gray-200 text-gray-700', 'bg-gray-100 text-gray-600']

export function Competitor() {
  return (
    <div className="app-page">
      <section className="app-section-card app-section-card-muted p-5 sm:p-6">
        <div className="app-section-header">
          <div>
            <div className="app-section-kicker">Market Watch</div>
            <div className="app-section-title mt-2">
              <Radar size={18} className="text-accent" />
              <h3 className="text-title font-semibold">竞对档案与排名</h3>
            </div>
            <p className="mt-2 text-body leading-6 text-[var(--color-text-muted)]">
              聚焦重点对手、区域覆盖和近期动态，方便在项目推进前快速对照风险点。
            </p>
          </div>
          <span className="app-pill app-pill-warning">重点关注 1 家</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="app-table-shell p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">竞争对手排名</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {competitors.map((competitor, index) => (
              <div key={competitor.name} className="flex items-center gap-4 py-4 first:pt-0">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-body font-semibold ${rankStyles[index]}`}
                >
                  {competitor.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{competitor.name}</div>
                  <div className="text-body leading-6 text-gray-600">{competitor.area}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-caption font-medium ${competitor.tagStyle}`}>
                  {competitor.tag}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="app-table-shell p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Radar size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">XX大型餐饮集团 · 档案详情</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[20px] border border-[var(--color-border)] bg-white/76 p-4 text-body leading-7 text-gray-600">
              <strong className="text-gray-900">经营模式：</strong>
              直营 + 加盟，重点覆盖 K12 学校食堂配餐。
            </div>
            <div className="rounded-[20px] border border-[var(--color-border)] bg-white/76 p-4 text-body leading-7 text-gray-600">
              <strong className="text-gray-900">优势：</strong>
              资金充裕、品牌知名度高、规模化采购成本低。
            </div>
            <div className="rounded-[20px] border border-[var(--color-border)] bg-white/76 p-4 text-body leading-7 text-gray-600">
              <strong className="text-gray-900">短板：</strong>
              服务灵活性较弱，定制化能力偏弱，高管层变动频繁。
            </div>
            <div className="rounded-[20px] border border-[var(--color-border)] bg-white/76 p-4 text-body leading-7 text-gray-600">
              <strong className="text-gray-900">近期动向：</strong>
              2025 年 Q1 新签深圳项目 3 个，正在扩充团队。
            </div>
          </div>
          <div className="mt-4">
            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-caption text-gray-700">
              最后更新：2025-06-01
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
