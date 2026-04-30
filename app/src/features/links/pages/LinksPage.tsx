import {
  ArrowUpRight,
  ClipboardList,
  KanbanSquare,
  Leaf,
  Shield,
  Store,
  Telescope,
  UtensilsCrossed,
} from 'lucide-react'
import { env } from '@/app/config/env'
import { logger } from '@/shared/lib/logger'

const systemLinks = [
  { icon: Shield, name: '安全管理系统', url: env.links.safety },
  { icon: Leaf, name: '青禾链', url: env.links.qinghe },
  { icon: UtensilsCrossed, name: '智慧餐饮系统', url: env.links.catering },
  { icon: ClipboardList, name: 'CRM 系统', url: env.links.crm },
  { icon: Telescope, name: '观海1号', url: env.links.guanhai },
]

const boardLinks = [
  {
    icon: KanbanSquare,
    name: '人事管理云',
    url: 'https://hailiang.feishu.cn/app/JTv8b4oPQassQKsHYBwcuFEmnFc?pageId=pgeNv1I5170puLXI',
  },
  {
    icon: KanbanSquare,
    name: '供应链精益管理',
    url: 'https://hailiang.feishu.cn/app/CPPwbLKCHatdCIsvm4Pc5c5fn2b?pageId=pgeQDmgBh2NXsxiU',
  },
  {
    icon: KanbanSquare,
    name: '干部排班表',
    url: 'https://hailiang.feishu.cn/file/KBMnbg2YCoFtA1xVbYrc70sgnYe',
  },
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
      logger.error('Failed to open system link', error)
    }
  }

  const renderLinkGrid = (
    title: string,
    description: string,
    links: Array<{ icon: typeof Shield; name: string; url: string }>
  ) => (
    <section className="app-table-shell p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-body font-semibold text-[var(--color-text-strong)]">{title}</h2>
        <p className="mt-1 text-caption text-[var(--color-text-muted)]">{description}</p>
      </div>

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
  )

  return (
    <div className="app-page">
      {renderLinkGrid('系统', '当前已有的 5个系统入口。', systemLinks)}
      {renderLinkGrid('看板', '常用业务看板入口。', boardLinks)}
    </div>
  )
}
