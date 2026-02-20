import { PageTitle } from '@/components/ui/PageTitle'
import { Link2, Shield, Leaf, Store, UtensilsCrossed, ClipboardList, Telescope } from 'lucide-react'

const links = [
  { icon: Shield, name: '安全管理系统' },
  { icon: Leaf, name: '青禾链' },
  { icon: Store, name: '海鼎系统' },
  { icon: UtensilsCrossed, name: '智慧餐饮系统' },
  { icon: ClipboardList, name: 'CRM 系统' },
  { icon: Telescope, name: '观海1号' },
]

export function Links() {
  return (
    <>
      <PageTitle breadcrumb="工具与分析 / 系统链接" title="系统链接" />

      <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-6">
          <Link2 size={18} strokeWidth={1.5} className="text-gray-600" />
          <h3 className="font-medium text-gray-900">常用系统入口（点击跳转）</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {links.map((l) => {
            const Icon = l.icon
            return (
              <a
                key={l.name}
                href="#"
                className="flex flex-col items-center gap-3 p-5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all"
              >
                <div className="w-12 h-12 rounded flex items-center justify-center bg-primary-50 text-primary">
                  <Icon size={24} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-gray-900 text-center">{l.name}</span>
              </a>
            )
          })}
        </div>
      </div>
    </>
  )
}
