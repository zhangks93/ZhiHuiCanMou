import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useAuth } from '@/hooks/useAuth'

export function MainLayout() {
  const { user: currentUser } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        userName={currentUser?.name ?? null}
        avatarUrl={currentUser?.avatarUrl ?? null}
      />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />
      <main
        className={`
          h-screen overflow-y-auto transition-[padding] duration-200 ease-out
          pt-[5.5rem] pl-4 pr-4
          pb-20 lg:pb-8
          lg:pr-8
          ${sidebarCollapsed ? 'lg:pl-[96px]' : 'lg:pl-[244px]'}
        `}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
