import { PageTitle } from '@/components/ui/PageTitle'
import { BarChart3 } from 'lucide-react'

const bizData = [
  { unit: '后勤集团整体', budget: '3,200万', actual: '2,624万', rate: 82, profitRate: 85, warn: null },
  { unit: '东区项目组', budget: '680万', actual: '537万', rate: 79, profitRate: 76, warn: 'yellow' },
  { unit: '北区餐饮配送', budget: '520万', actual: '354万', rate: 68, profitRate: 65, warn: 'red' },
  { unit: '数智零售（线上）', budget: '360万', actual: '342万', rate: 95, profitRate: 98, warn: null },
  { unit: '数智零售（线下）', budget: '280万', actual: '229万', rate: 82, profitRate: 83, warn: null },
  { unit: '学校食堂（普餐）', budget: '420万', actual: '370万', rate: 88, profitRate: 89, warn: null },
  { unit: '学校食堂（特色餐）', budget: '180万', actual: '126万', rate: 70, profitRate: 65, warn: 'yellow' },
]

function RateBadge({ rate }: { rate: number }) {
  const style = rate >= 80 ? 'bg-success-100 text-success-700' : rate >= 70 ? 'bg-warning-100 text-warning-700' : 'bg-error-100 text-error-700'
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${style}`}>{rate}%</span>
}

export function BizData() {
  return (
    <>
      <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" />

      <div className="bg-surface rounded-lg border border-gray-200 overflow-hidden shadow-card">
        <div className="p-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">本月经营达成总览</h3>
          </div>
          <div className="flex gap-4 text-xs text-gray-500 ml-auto">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-warning" /> 黄色预警 &lt;80%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error" /> 红色预警 &lt;70%
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">业务板块</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">预算营收</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">实际营收</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">达成率</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">预算利润</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">利润达成率</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">预警</th>
              </tr>
            </thead>
            <tbody>
              {bizData.map((row) => (
                <tr key={row.unit} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{row.unit}</td>
                  <td className="py-3 px-4 text-gray-600">{row.budget}</td>
                  <td className="py-3 px-4 text-gray-600">{row.actual}</td>
                  <td className="py-3 px-4"><RateBadge rate={row.rate} /></td>
                  <td className="py-3 px-4 text-gray-600">—</td>
                  <td className="py-3 px-4"><RateBadge rate={row.profitRate} /></td>
                  <td className="py-3 px-4">
                    {row.warn && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        <span className={`w-2 h-2 rounded-full ${row.warn === 'red' ? 'bg-error' : 'bg-warning'}`} />
                        {row.warn === 'red' ? '红色预警' : '黄色预警'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
