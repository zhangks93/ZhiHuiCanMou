import { NavLink } from 'react-router-dom'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { ROUTES } from '@/app/config/constants'

export function BottomNav() {
  const { topLevelNav } = useEnabledModules()

  return (
    <div className="sticky bottom-0 z-30 px-3 pb-3 pt-2 sm:px-4 lg:hidden">
      <nav className="rounded-[26px] border border-[var(--color-border)] bg-white/92 px-2 py-2 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl safe-area-inset-bottom">
        <div className="grid grid-cols-4 gap-1">
          {topLevelNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.HOME}
              className={({ isActive }) =>
                [
                  'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all',
                  isActive
                    ? 'bg-[rgba(37,99,235,0.08)] text-[var(--color-text-strong)]'
                    : 'text-[var(--color-text-muted)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2 : 1.7} />
                  <span className="text-caption font-semibold tracking-[0.06em] [font-family:var(--font-family-body)]">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
