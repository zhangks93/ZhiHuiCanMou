import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, LogOut, X } from 'lucide-react'
import { useEnabledModules, type NavItem } from '@/app/hooks/useEnabledModules'
import { useAuth } from '@/app/hooks/useAuth'
import { ROUTES } from '@/app/config/constants'

export function BottomNav() {
  const { navSections } = useEnabledModules()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)

  const allNavItems = useMemo(() => navSections.flatMap((section) => section.items), [navSections])
  const primaryNavItems = useMemo(() => {
    const homeItem = allNavItems.find((item) => item.to === '/')
    const aiItem = allNavItems.find((item) => item.to === '/ai')
    const scheduleItem = allNavItems.find((item) => item.to === '/schedule')
    const bizDataItem = allNavItems.find((item) => item.to === '/biz-data')

    return [homeItem, scheduleItem, bizDataItem, aiItem].filter(
      (item): item is NavItem => Boolean(item)
    )
  }, [allNavItems])
  const primaryNavPaths = new Set(primaryNavItems.map((item) => item.to))
  const moreNavItems = allNavItems.filter((item) => !primaryNavPaths.has(item.to))

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        panelRef.current?.contains(event.target as Node) ||
        profileButtonRef.current?.contains(event.target as Node)
      ) {
        return
      }

      setShowProfilePanel(false)
    }

    if (!showProfilePanel) return

    const timer = window.setTimeout(() => {
      document.addEventListener('click', handler)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', handler)
    }
  }, [showProfilePanel])

  const handleSignOut = async () => {
    await signOut()
    setShowProfilePanel(false)
    navigate(ROUTES.LOGIN)
  }

  return (
    <>
      {showProfilePanel && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/24 lg:hidden"
          onClick={() => setShowProfilePanel(false)}
          aria-label="关闭个人菜单"
        />
      )}

      {showProfilePanel && (
        <div
          ref={panelRef}
          className="fixed inset-x-4 bottom-20 z-50 overflow-y-auto rounded-[28px] border border-[var(--color-border)] bg-white/95 p-3 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden animate-slide-up"
        >
          <div className="mb-3 flex items-center gap-3 rounded-3xl bg-[rgba(15,23,42,0.04)] p-3">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? '用户头像'}
                className="h-12 w-12 rounded-2xl object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white">
                {(user?.name ?? 'U').charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-[var(--color-text-strong)]">
                {user?.name ?? '当前用户'}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowProfilePanel(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[var(--color-text-muted)] transition-colors hover:bg-[rgba(15,23,42,0.06)]"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>

          <button
            type="button"
            className="mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] text-[var(--color-text)] transition-colors hover:bg-[rgba(15,23,42,0.04)] [font-family:var(--font-family-body)]"
          >
            <div className="relative">
              <Bell size={18} strokeWidth={1.8} />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            </div>
            <span className="text-sm">通知</span>
          </button>

          {moreNavItems.length > 0 && (
            <div className="space-y-1 border-t border-[var(--color-border)] pt-2">
              <div className="px-3 py-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-text-muted)] [font-family:var(--font-family-body)]">
                更多页面
              </div>
              {moreNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowProfilePanel(false)}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] transition-colors [font-family:var(--font-family-body)]',
                      isActive
                        ? 'bg-[rgba(37,99,235,0.08)] text-[var(--color-text-strong)]'
                        : 'text-[var(--color-text)] hover:bg-[rgba(15,23,42,0.04)]',
                    ].join(' ')
                  }
                >
                  <item.icon size={18} strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl border-t border-[var(--color-border)] px-3 py-3 text-left text-[15px] text-red-600 transition-colors hover:bg-red-50 [font-family:var(--font-family-body)]"
          >
            <LogOut size={18} strokeWidth={1.8} />
            <span className="text-sm">退出登录</span>
          </button>
        </div>
      )}

      <nav className="fixed inset-x-4 bottom-4 z-30 rounded-[26px] border border-[var(--color-border)] bg-white/92 px-2 py-2 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden safe-area-inset-bottom">
        <div className="flex items-center justify-around gap-1">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex min-w-[68px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 transition-all',
                  isActive
                    ? 'bg-[rgba(37,99,235,0.08)] text-[var(--color-text-strong)]'
                    : 'text-[var(--color-text-muted)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2 : 1.7} />
                  <span className="text-xs font-semibold tracking-[0.06em] [font-family:var(--font-family-body)]">
                    {item.label.length > 10 ? item.label.slice(0, 8) : item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => setShowProfilePanel((value) => !value)}
            className={[
              'flex min-w-[68px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 transition-all',
              showProfilePanel
                ? 'bg-[rgba(37,99,235,0.08)] text-[var(--color-text-strong)]'
                : 'text-[var(--color-text-muted)]',
            ].join(' ')}
            aria-label="我的"
          >
            <div className="relative">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? '用户头像'}
                  className="h-5 w-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white">
                  {(user?.name ?? 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            </div>
            <span className="text-[10px] font-semibold tracking-[0.08em]">我的</span>
          </button>
        </div>
      </nav>
    </>
  )
}
