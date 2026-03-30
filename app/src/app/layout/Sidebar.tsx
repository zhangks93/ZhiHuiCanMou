import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { useAuth } from '@/app/hooks/useAuth'
import { ROUTES } from '@/app/config/constants'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { topLevelNav } = useEnabledModules()
  const { user } = useAuth()
  const userInitial = useMemo(
    () => (user?.name ?? 'U').trim().charAt(0).toUpperCase(),
    [user?.name],
  )

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden"
          onClick={onClose}
          aria-label="关闭导航"
        />
      )}

      <aside
        className={[
          'fixed inset-y-4 left-4 z-50 flex flex-col overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white/86 shadow-[0_24px_64px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-all duration-200 ease-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-[115%]',
          collapsed ? 'w-[92px]' : 'w-[248px]',
        ].join(' ')}
      >
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? '用户头像'}
                className="h-11 w-11 rounded-2xl object-cover shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-body font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
                {userInitial}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-[var(--color-text-strong)] [font-family:var(--font-family-body)]">
                  {user?.name ?? '当前用户'}
                </p>
                <p className="truncate text-caption text-[var(--color-text-muted)]">个人工作台</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-1">
              {topLevelNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === ROUTES.HOME}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    [
                      'group flex min-h-[52px] items-center rounded-2xl border border-transparent text-body transition-all duration-200 [font-family:var(--font-family-body)]',
                      collapsed ? 'justify-center px-0' : 'gap-3 px-3.5',
                      isActive
                        ? 'border-[rgba(37,99,235,0.14)] bg-[rgba(37,99,235,0.08)] text-[var(--color-text-strong)] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
                        : 'text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)]',
                    ].join(' ')
                  }
                >
                  <item.icon size={18} strokeWidth={1.7} className="shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="hidden border-t border-[var(--color-border)] pt-3 lg:block">
            <button
              type="button"
              onClick={onToggleCollapse}
              className={[
                  'flex w-full items-center rounded-2xl border border-transparent px-3 py-3 text-body text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)] [font-family:var(--font-family-body)]',
                collapsed ? 'justify-center' : 'gap-2.5',
              ].join(' ')}
              title={collapsed ? '展开导航' : '收起导航'}
              aria-label={collapsed ? '展开导航' : '收起导航'}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} strokeWidth={1.7} />
              ) : (
                <>
                  <PanelLeftClose size={18} strokeWidth={1.7} />
                  <span>收起导航</span>
                </>
              )}
            </button>
          </div>
        </nav>
      </aside>
    </>
  )
}
