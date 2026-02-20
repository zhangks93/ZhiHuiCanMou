import { PageTitle } from '@/components/ui/PageTitle'
import { Settings as SettingsIcon } from 'lucide-react'

const modules = [
  '日程提醒', '常用数据', '经营数据', '商机管理',
  '竞对档案', '出差管理', '考勤管理', '系统链接', '智能分析',
]

export function Settings() {
  return (
    <>
      <PageTitle breadcrumb="/ 设置" title="设置" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-800">预警阈值配置</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">业务板块</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">黄色预警</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">红色预警</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 text-gray-800">后勤集团 / 三中心 / 三区域</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 80%</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 70%</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 text-gray-800">自有学校食堂</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 80%</td>
                  <td className="py-2 px-3 text-gray-600">&lt; 72%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-4">※ 阈值调整请联系系统管理员</p>
        </div>

        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-800">功能模块管理</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {modules.map((m) => (
              <span key={m} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                {m}
              </span>
            ))}
          </div>
          <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-700 transition-colors shadow-sm">
            + 动态添加模块
          </button>
          <p className="text-xs text-gray-600 mt-2">功能开发中，请联系IT部门</p>
        </div>
      </div>
    </>
  )
}
