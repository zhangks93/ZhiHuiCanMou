import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

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
          'relative h-screen min-h-0 flex-1 overflow-hidden pb-4 pr-6 pt-4 transition-[padding] duration-200 ease-out xl:pr-8',
          sidebarCollapsed ? 'pl-[104px]' : 'pl-[220px]',
        ].join(' ')}
      >
        <div className="app-main-surface">
          <div className="app-main-body">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
