import { ArrowUpRight, ClipboardList, Leaf, Shield, Store, Telescope, UtensilsCrossed } from 'lucide-react'

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
    <div className="app-page">
      <section className="app-table-shell p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <a
                key={link.name}
                href="#"
                className="group flex items-center gap-4 rounded-[22px] border border-[var(--color-border)] bg-white/72 p-4 transition-all hover:-translate-y-0.5 hover:border-[rgba(95,127,188,0.22)] hover:bg-white/92 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent">
                  <Icon size={22} strokeWidth={1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold text-[var(--color-text-strong)]">{link.name}</div>
                  <div className="mt-1 text-caption text-[var(--color-text-muted)]">点击后进入对应业务系统</div>
                </div>
                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-accent-hover)]"
                />
              </a>
            )
          })}
        </div>
      </section>
    </div>
  )
}
