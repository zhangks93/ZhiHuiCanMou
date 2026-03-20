import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  return (
    <div className="app-shell-grid bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />

      {!sidebarOpen && (
        <button
          type="button"
          className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/92 text-[var(--color-text)] shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)] lg:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="打开导航"
        >
          <Menu size={18} strokeWidth={1.8} />
        </button>
      )}

      <main
        className={[
          'relative z-10 min-h-screen px-4 pb-24 pt-20 transition-[padding] duration-200 ease-out lg:px-6 lg:pb-10 lg:pt-6',
          sidebarCollapsed ? 'lg:pl-[122px]' : 'lg:pl-[274px]',
        ].join(' ')}
      >
        <div className="mx-auto max-w-[1440px] pb-6">
          <div className="app-panel app-panel-strong min-h-[calc(100vh-6rem)] overflow-visible px-4 py-4 sm:px-6 sm:py-6 lg:min-h-[calc(100vh-3rem)] lg:px-8">
            <Outlet />
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
