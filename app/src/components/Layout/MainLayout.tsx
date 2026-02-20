import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'

export function MainLayout() {
  const { user: currentUser } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="min-h-screen bg-background">
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
          min-h-screen transition-[padding] duration-200 ease-out
          pt-[5.5rem] pl-4 pr-4 pb-8
          lg:pr-8
          ${sidebarCollapsed ? 'lg:pl-[96px]' : 'lg:pl-[244px]'}
        `}
      >
        <Outlet />
      </main>
    </div>
  )
}
