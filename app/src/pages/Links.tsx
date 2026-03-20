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
    <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
      <div className="flex items-center gap-2 mb-6">
        <Link2 size={18} strokeWidth={1.5} className="text-gray-600" />
        <h3 className="font-medium text-gray-900">常用系统入口（点击跳转）</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <a
              key={link.name}
              href="#"
              className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-5 transition-all hover:border-gray-300 hover:bg-gray-100"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded bg-primary-50 text-primary">
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <span className="text-center text-sm font-medium text-gray-900">{link.name}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
