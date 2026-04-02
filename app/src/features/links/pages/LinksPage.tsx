import { ArrowUpRight, ClipboardList, Leaf, Shield, Store, Telescope, UtensilsCrossed } from 'lucide-react'
import { env } from '@/app/config/env'

const links = [
  { icon: Shield, name: '安全管理系统', url: env.links.safety },
  { icon: Leaf, name: '青禾链', url: env.links.qinghe },
  { icon: Store, name: '海鼎系统', url: env.links.haiding },
  { icon: UtensilsCrossed, name: '智慧餐饮系统', url: env.links.catering },
  { icon: ClipboardList, name: 'CRM 系统', url: env.links.crm },
  { icon: Telescope, name: '观海1号', url: env.links.guanhai },
]

function isTauriApp() {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function openSystemLink(url: string) {
  if (isTauriApp()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

export function Links() {
  const handleOpenLink = async (url: string) => {
    try {
      await openSystemLink(url)
    } catch (error) {
      console.error('[Canmou] Failed to open system link:', error)
    }
  }

  return (
    <div className="app-page">
      <section className="app-table-shell p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon
            const isConfigured = Boolean(link.url)
            return (
              <button
                type="button"
                key={link.name}
                onClick={() => {
                  if (!link.url) return
                  void handleOpenLink(link.url)
                }}
                disabled={!isConfigured}
                className="group flex w-full items-center gap-4 rounded-[22px] border border-[var(--color-border)] bg-white/72 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[rgba(95,127,188,0.22)] hover:bg-white/92 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-[var(--color-border)] disabled:hover:bg-white/72 disabled:hover:shadow-none"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent">
                  <Icon size={22} strokeWidth={1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold text-[var(--color-text-strong)]">{link.name}</div>
                  <div className="mt-1 truncate text-caption text-[var(--color-text-muted)]">
                    {link.url || '链接地址未配置'}
                  </div>
                </div>
                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-accent-hover)]"
                />
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
