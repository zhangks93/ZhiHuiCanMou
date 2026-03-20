import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, Menu, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type HeaderProps = {
  onMenuClick?: () => void
}

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: '首页', subtitle: '运营驾驶舱' },
  '/work-report': { title: '项目协同', subtitle: '看板与任务推进' },
  '/schedule': { title: '日程提醒', subtitle: '今日安排与提醒' },
  '/org-data': { title: '常用数据', subtitle: '组织与基础信息' },
  '/biz-data': { title: '经营数据', subtitle: '经营结果与趋势分析' },
  '/opportunity': { title: '商机台账', subtitle: '项目机会与进展跟踪' },
  '/competitor': { title: '竞对档案', subtitle: '竞争对手信息整理' },
  '/trip': { title: '出差管理', subtitle: '行程与人员记录' },
  '/attendance': { title: '考勤管理', subtitle: '出勤统计与明细' },
  '/links': { title: '系统链接', subtitle: '常用入口与资源导航' },
  '/ai': { title: 'AI 分析', subtitle: '智能问答与分析报告' },
  '/settings': { title: '设置', subtitle: '系统配置与模块管理' },
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()
  const { user } = useAuth()
  const [date] = useState(() =>
    new Date().toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })
  )

  const pageMeta = PAGE_META[location.pathname] ?? PAGE_META['/']
  const userInitial = useMemo(
    () => (user?.name ?? 'U').trim().charAt(0).toUpperCase(),
    [user?.name]
  )

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 lg:px-6">
      <div className="mx-auto max-w-[1440px]">
        <div className="app-panel app-panel-strong flex h-[72px] items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-text)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)] lg:hidden"
            onClick={onMenuClick}
            aria-label="打开导航"
          >
            <Menu size={18} strokeWidth={1.8} />
          </button>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-text)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]"
              onClick={onMenuClick}
              aria-label="切换导航"
            >
              <Menu size={18} strokeWidth={1.8} />
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
              CM
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-[var(--color-text-muted)]">
                <span className="truncate">参谋工作台</span>
                <ChevronRight size={12} strokeWidth={1.8} className="shrink-0" />
                <span className="truncate">{pageMeta.title}</span>
              </div>
              <div className="truncate text-sm font-semibold text-[var(--color-text-strong)] sm:text-base">
                {pageMeta.subtitle}
              </div>
            </div>

            <div className="hidden min-w-0 max-w-[320px] flex-1 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text-muted)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:flex">
              <Search size={16} strokeWidth={1.8} />
              <span className="truncate">搜索页面、报表或指标</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-2xl bg-[rgba(15,23,42,0.04)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] sm:inline-flex">
              {date}
            </div>

            <button
              type="button"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-strong)]"
              aria-label="通知中心"
            >
              <Bell size={18} strokeWidth={1.8} />
              <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            </button>

            <Link
              to="/settings"
              className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white pl-2 pr-3 text-[var(--color-text)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]"
              aria-label="打开个人设置"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? '用户头像'}
                  className="h-7 w-7 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-950 text-[11px] font-semibold text-white">
                  {userInitial}
                </div>
              )}

              <div className="hidden min-w-0 text-left md:block">
                <div className="max-w-[108px] truncate text-xs font-semibold text-[var(--color-text-strong)]">
                  {user?.name ?? '当前用户'}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">个人设置</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
