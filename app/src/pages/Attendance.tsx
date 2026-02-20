import { PageTitle } from '@/components/ui/PageTitle'
import { Clock } from 'lucide-react'

const summary = [
  { value: '94.6%', label: '整体出勤率', border: 'border-t-primary' },
  { value: '12', label: '请假人次', border: 'border-t-warning' },
  { value: '3', label: '迟到/早退', border: 'border-t-error' },
]

const deptData = [
  { dept: '运营中心', expected: 8648, actual: 8270, rate: 95.6, leave: 8, late: 2, absent: 0 },
  { dept: '配送中心', expected: 7476, actual: 7020, rate: 93.9, leave: 12, late: 3, absent: 1 },
  { dept: '零售中心', expected: 5880, actual: 5645, rate: 96.0, leave: 5, late: 1, absent: 0 },
  { dept: '职能部门', expected: 4200, actual: 4074, rate: 97.0, leave: 3, late: 0, absent: 0 },
]

function RateBadge({ rate }: { rate: number }) {
  const style = rate >= 95 ? 'bg-success-100 text-success-700' : rate >= 90 ? 'bg-warning-100 text-warning-700' : 'bg-error-100 text-error-700'
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${style}`}>{rate}%</span>
}

export function Attendance() {
  return (
    <>
      <PageTitle breadcrumb="业务管理 / 考勤管理" title="考勤管理" />

      <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} strokeWidth={1.5} className="text-gray-600" />
          <h3 className="font-medium text-gray-800">本月考勤汇总（2025年6月）</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {summary.map((s) => (
            <div
              key={s.label}
              className={`text-center p-4 rounded-lg bg-gray-50 border-t-4 ${s.border}`}
            >
              <div className="text-xl font-semibold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">部门/项目</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">应出勤（天）</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">实出勤（天）</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">出勤率</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">请假</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">迟到早退</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">旷工</th>
              </tr>
            </thead>
            <tbody>
              {deptData.map((d) => (
                <tr key={d.dept} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-800">{d.dept}</td>
                  <td className="py-2 px-3 text-gray-600">{d.expected.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-600">{d.actual.toLocaleString()}</td>
                  <td className="py-2 px-3"><RateBadge rate={d.rate} /></td>
                  <td className="py-2 px-3 text-gray-600">{d.leave}</td>
                  <td className="py-2 px-3 text-gray-600">{d.late}</td>
                  <td className="py-2 px-3 text-gray-600">{d.absent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
