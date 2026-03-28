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
          'relative h-screen overflow-y-auto px-5 pb-24 pt-6 transition-[padding] duration-200 ease-out md:px-6 lg:pr-8 lg:pb-10 lg:pt-8 xl:pr-10',
          sidebarCollapsed ? 'lg:pl-[132px]' : 'lg:pl-[284px]',
        ].join(' ')}
      >
        <div className="mx-auto max-w-[1360px] pb-6">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
