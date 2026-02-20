import { NavLink } from 'react-router-dom'
import {
  Home,
  Calendar,
  Users,
  BarChart3,
  Target,
  Trophy,
  Plane,
  Clock,
  Link2,
  Sparkles,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

const navSections = [
  {
    title: '工作台',
    items: [
      { to: '/', icon: Home, label: '首页总览' },
      { to: '/schedule', icon: Calendar, label: '日程提醒', badge: 3 },
    ],
  },
  {
    title: '数据中心',
    items: [
      { to: '/org-data', icon: Users, label: '常用数据' },
      { to: '/biz-data', icon: BarChart3, label: '经营数据', badge: '!' },
    ],
  },
  {
    title: '业务管理',
    items: [
      { to: '/opportunity', icon: Target, label: '商机管理' },
      { to: '/competitor', icon: Trophy, label: '竞对档案' },
      { to: '/trip', icon: Plane, label: '出差管理' },
      { to: '/attendance', icon: Clock, label: '考勤管理' },
    ],
  },
  {
    title: '工具与分析',
    items: [
      { to: '/links', icon: Link2, label: '系统链接' },
      { to: '/ai', icon: Sparkles, label: '智能分析' },
      { to: '/settings', icon: Settings, label: '设置' },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          fixed top-14 left-0 bottom-0 z-50
          bg-primary border-r border-primary-dark/30 overflow-y-auto overflow-x-hidden
          transform transition-all duration-200 ease-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          w-[220px] ${collapsed ? 'lg:w-[72px]' : 'lg:w-[220px]'}
        `}
      >
        <nav className="py-4 flex flex-col h-full">
          <div className="flex-1">
            {navSections.map((section) => (
              <div key={section.title} className="mb-5">
                {!collapsed && (
                  <div className="px-4 py-1.5 text-[11px] text-primary-300 uppercase tracking-widest font-medium">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center transition-all duration-200 min-h-[44px]
                      ${collapsed ? 'justify-center px-0 py-3 mx-2 rounded-lg' : 'gap-2.5 px-4 py-2 mx-2 rounded-lg'}
                      ${isActive
                        ? 'bg-accent/20 text-accent-300 font-medium'
                        : 'text-primary-200 hover:bg-primary-light/50 hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={20} strokeWidth={1.5} className="flex-shrink-0 opacity-90" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate text-sm">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/30 text-accent-200 font-medium">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
          <div className="hidden lg:block p-2 border-t border-primary-dark/40">
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-lg text-primary-300 hover:bg-primary-light/50 hover:text-white transition-colors"
              title={collapsed ? '展开导航栏' : '收起导航栏'}
              aria-label={collapsed ? '展开导航栏' : '收起导航栏'}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} strokeWidth={1.5} />
              ) : (
                <>
                  <PanelLeftClose size={20} strokeWidth={1.5} />
                  <span className="text-sm">收起</span>
                </>
              )}
            </button>
          </div>
        </nav>
      </aside>
    </>
  )
}
