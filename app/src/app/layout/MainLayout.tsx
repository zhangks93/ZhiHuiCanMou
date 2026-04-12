import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="app-shell-grid bg-background">
      <Sidebar
        isOpen={false}
        onClose={() => {}}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />

      <main
        className={[
          'relative min-h-0 flex-1 px-3 pb-3 pt-3 transition-[padding] duration-200 ease-out sm:px-4 md:px-5 lg:h-screen lg:overflow-hidden lg:pr-6 lg:pb-4 lg:pt-4 xl:pr-8',
          sidebarCollapsed ? 'lg:pl-[104px]' : 'lg:pl-[220px]',
        ].join(' ')}
      >
        <div className="app-main-surface">
          <div className="app-main-body">
            <Outlet />
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
