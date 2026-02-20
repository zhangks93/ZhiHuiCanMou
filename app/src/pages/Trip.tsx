import { PageTitle } from '@/components/ui/PageTitle'
import { Plane } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'

const inTrip = [
  { name: '余江', dept: '市场部', dest: '广州', start: '06-17', end: '06-20', reason: '客户拜访' },
  { name: '王志远', dept: '市场部', dest: '深圳', start: '06-18', end: '06-19', reason: '商务洽谈' },
  { name: '张敏', dept: '运营中心', dest: '东莞', start: '06-16', end: '06-18', reason: '项目巡查' },
]

export function Trip() {
  return (
    <>
      <PageTitle breadcrumb="业务管理 / 出差管理" title="出差管理" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Plane size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">当前在途人员（实时）</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">姓名</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">部门</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">目的地</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">出发日</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">预计返回</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">事由</th>
                </tr>
              </thead>
              <tbody>
                {inTrip.map((r) => (
                  <tr key={r.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2 px-3 text-gray-600">{r.dept}</td>
                    <td className="py-2 px-3 text-gray-600">{r.dest}</td>
                    <td className="py-2 px-3 text-gray-600">{r.start}</td>
                    <td className="py-2 px-3 text-gray-600">{r.end}</td>
                    <td className="py-2 px-3 text-gray-600">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Plane size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">本月出差统计</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="累计出差人次" value="28" unit="人次" />
            <StatCard label="累计出差天数" value="76" unit="天" />
            <StatCard label="差旅费用合计" value="8.2" unit="万" />
            <StatCard label="人均出差天数" value="2.7" unit="天" color="success" />
          </div>
        </div>
      </div>
    </>
  )
}
