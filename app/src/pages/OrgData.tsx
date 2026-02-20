import { PageTitle } from '@/components/ui/PageTitle'
import { Users } from 'lucide-react'

const orgCards = [
  {
    title: '后勤集团',
    value: '1,248',
    sub: '总员工数',
    rows: [
      { dept: '运营中心', count: 412, pct: '33%' },
      { dept: '配送中心', count: 356, pct: '29%' },
      { dept: '零售中心', count: 280, pct: '22%' },
      { dept: '职能部门', count: 200, pct: '16%' },
    ],
    cols: ['部门', '人数', '占比'],
  },
  {
    title: '干部人数',
    value: '186',
    sub: '管理干部（按级别）',
    rows: [
      { dept: '高管（总监及以上）', count: 12 },
      { dept: '中层（经理级）', count: 48 },
      { dept: '基层（主管级）', count: 126 },
    ],
    cols: ['级别', '人数'],
  },
  {
    title: '教育集团',
    value: '3,642',
    sub: '教职员工 + 学生',
    rows: [
      { dept: '管理部门', count: 120 },
      { dept: '教职员工', count: 842 },
      { dept: '学生总数', count: 2680 },
    ],
    cols: ['类别', '人数'],
  },
]

export function OrgData() {
  return (
    <>
      <PageTitle breadcrumb="数据中心 / 常用数据" title="常用数据" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgCards.map((card) => (
          <div
            key={card.title}
            className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users size={18} strokeWidth={1.5} className="text-gray-600" />
              <h3 className="font-medium text-gray-700">{card.title}</h3>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-600 mb-4">{card.sub}</div>
            <div className="border-t border-gray-200 pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-600 text-xs">
                    {card.cols.map((c) => (
                      <th key={c} className="text-left py-1.5 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {card.rows.map((r) => (
                    <tr key={r.dept} className="border-t border-gray-100">
                      <td className="py-2 text-gray-700">{r.dept}</td>
                      <td className="py-2 text-gray-700">{r.count}</td>
                      {'pct' in r && (
                        <td className="py-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{(r as { pct: string }).pct}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
