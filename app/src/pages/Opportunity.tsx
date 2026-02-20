import { useState } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Target } from 'lucide-react'

const stages = [
  { name: '初期洽谈', count: 5 },
  { name: '中期推进', count: 8 },
  { name: '拟标阶段', count: 7 },
  { name: '投标攻坚', count: 4 },
  { name: '落地运营', count: 3 },
]

const opportunities = [
  { level: 'A', name: '广东某高校配餐项目', meta: '广州区域 · 初期洽谈 · 余江负责', amount: '800万' },
  { level: 'A', name: '深圳科技园餐饮运营', meta: '深圳区域 · 初期洽谈 · 王志远负责', amount: '620万' },
  { level: 'B', name: '东莞工业园后勤外包', meta: '东莞区域 · 初期洽谈 · 张敏负责', amount: '340万' },
]

const staffData = [
  { name: '余江', join: '2021-03', a: 3, b: 5, c: 2, amount: '2,200万' },
  { name: '王志远', join: '2022-06', a: 2, b: 3, c: 4, amount: '1,400万' },
  { name: '张敏', join: '2023-01', a: 1, b: 2, c: 3, amount: '680万' },
  { name: '李晓峰', join: '2024-04', a: 0, b: 1, c: 2, amount: '220万' },
]

const levelStyles: Record<string, string> = {
  A: 'bg-warning-100 text-warning-700',
  B: 'bg-gray-200 text-gray-700',
  C: 'bg-gray-100 text-gray-600',
}

export function Opportunity() {
  const [activeStage, setActiveStage] = useState(0)

  return (
    <>
      <PageTitle breadcrumb="业务管理 / 商机管理" title="商机管理" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">商机进度分布</h3>
          </div>
          <div className="flex rounded-lg overflow-hidden mb-4 border border-gray-200">
            {stages.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveStage(i)}
                className={`flex-1 py-2 px-1 text-center text-xs transition-colors
                  ${i === activeStage ? 'bg-primary text-white font-medium' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
                `}
              >
                <span className="block text-base font-semibold">{s.count}</span>
                {s.name}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {opportunities.map((o) => (
              <div
                key={o.name}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-7 h-7 rounded flex items-center justify-center font-semibold text-sm ${levelStyles[o.level]}`}>
                  {o.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{o.name}</div>
                  <div className="text-xs text-gray-600 truncate">{o.meta}</div>
                </div>
                <div className="font-semibold text-gray-700 text-sm whitespace-nowrap">{o.amount}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">市场人员商机情况</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">姓名</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">入职时间</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">A级</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">B级</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">C级</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">估算金额</th>
                </tr>
              </thead>
              <tbody>
                {staffData.map((s) => (
                  <tr key={s.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{s.name}</td>
                    <td className="py-2 px-3 text-gray-600">{s.join}</td>
                    <td className="py-2 px-3 text-gray-600">{s.a}</td>
                    <td className="py-2 px-3 text-gray-600">{s.b}</td>
                    <td className="py-2 px-3 text-gray-600">{s.c}</td>
                    <td className="py-2 px-3 font-medium text-gray-900">{s.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
