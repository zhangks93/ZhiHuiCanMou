import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
  const { navSections } = useEnabledModules()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const userInitial = useMemo(
    () => (user?.name ?? 'U').trim().charAt(0).toUpperCase(),
    [user?.name],
  )

  const handleSignOut = async () => {
    await signOut()
    onClose()
    navigate(ROUTES.LOGIN)
  }

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
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
                {userInitial}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[var(--color-text-strong)] [font-family:var(--font-family-body)]">
                  {user?.name ?? '当前用户'}
                </p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">个人工作台</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
          <div className="flex-1 overflow-y-auto pr-1">
            {navSections.map((section) => (
              <div key={section.title} className="mb-6">
                {!collapsed && (
                  <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)] [font-family:var(--font-family-body)]">
                    {section.title}
                  </div>
                )}

                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        [
                          'group flex min-h-[52px] items-center rounded-2xl border border-transparent text-[15px] transition-all duration-200 [font-family:var(--font-family-body)]',
                          collapsed ? 'justify-center px-0' : 'gap-3 px-3.5',
                          isActive
                            ? 'border-[rgba(37,99,235,0.14)] bg-[rgba(37,99,235,0.08)] text-[var(--color-text-strong)] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
                            : 'text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)]',
                        ].join(' ')
                      }
                    >
                      <item.icon size={18} strokeWidth={1.7} className="shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] [font-family:var(--font-family-body)]">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden border-t border-[var(--color-border)] pt-3 lg:block">
            <div className="mb-3">
              <button
                type="button"
                onClick={handleSignOut}
                className={[
                  'flex w-full items-center rounded-2xl border border-transparent px-3 py-3 text-[15px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)] [font-family:var(--font-family-body)]',
                  collapsed ? 'justify-center' : 'gap-2.5',
                ].join(' ')}
                aria-label="退出登录"
              >
                <LogOut size={18} strokeWidth={1.7} />
                {!collapsed && <span>退出登录</span>}
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              className={[
                  'flex w-full items-center rounded-2xl border border-transparent px-3 py-3 text-[15px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[rgba(15,23,42,0.04)] hover:text-[var(--color-text-strong)] [font-family:var(--font-family-body)]',
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
