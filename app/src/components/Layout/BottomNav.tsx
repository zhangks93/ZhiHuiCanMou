import { NavLink } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Bell, LogOut, X } from 'lucide-react'
import { useEnabledModules } from '@/hooks/useEnabledModules'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/constants'

export function BottomNav() {
  const { navSections } = useEnabledModules()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  // 收集所有导航项
  const allNavItems = navSections.flatMap(section => section.items)

  // 移动端专用：缩短导航项名称为两个字
  const getMobileLabel = (label: string): string => {
    const mobileLabels: Record<string, string> = {
      '首页总览': '总览',
      '日程提醒': '日程',
      '常用数据': '数据',
      '经营数据': '经营',
      '商机管理': '商机',
      '竞对档案': '竞对',
      '出差管理': '出差',
      '考勤管理': '考勤',
      '系统链接': '链接',
      '智能分析': '分析',
      '项目协同': '协同',
    }
    return mobileLabels[label] || label.slice(0, 2)
  }

  // 自定义底部导航栏布局：
  // 1. 智能分析（原首页位置）
  // 2. 日程提醒
  // 3. 总览（中间位置，代替常用数据）
  // 4. 经营数据
  const getBottomNavItems = () => {
    const homeItem = allNavItems.find(item => item.to === '/')
    const aiItem = allNavItems.find(item => item.to === '/ai')
    const scheduleItem = allNavItems.find(item => item.to === '/schedule')
    const bizDataItem = allNavItems.find(item => item.to === '/biz-data')

    const bottomNavItems = []
    if (aiItem) bottomNavItems.push(aiItem)
    if (scheduleItem) bottomNavItems.push(scheduleItem)
    if (homeItem) bottomNavItems.push(homeItem)
    if (bizDataItem) bottomNavItems.push(bizDataItem)

    return bottomNavItems
  }

  const primaryNavItems = getBottomNavItems()

  // 更多菜单包含除了底部4个之外的所有导航项
  const primaryNavPaths = new Set(primaryNavItems.map(item => item.to))
  const moreNavItems = allNavItems.filter(item => !primaryNavPaths.has(item.to))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // 如果点击的是更多按钮或菜单面板内部，不关闭
      if (
        moreRef.current?.contains(e.target as Node) ||
        moreButtonRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setShowMore(false)
    }
    if (showMore) {
      // 使用 setTimeout 延迟添加监听器，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('click', handler)
      }, 0)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('click', handler)
      }
    }
  }, [showMore])

  const handleSignOut = async () => {
    await signOut()
    setShowMore(false)
    navigate(ROUTES.LOGIN)
  }

  return (
    <>
      {/* 更多菜单遮罩 */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden animate-fade-in"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* 更多菜单面板 */}
      {showMore && (
        <div
          ref={moreRef}
          className="fixed bottom-16 left-0 right-0 bg-surface border-t border-[var(--color-border)] z-50 lg:hidden animate-slide-up max-h-[70vh] overflow-y-auto"
        >
          {/* 用户信息区 */}
          <div className="p-4 border-b border-[var(--color-border)] bg-primary/5">
            <div className="flex items-center gap-3">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? '用户头像'}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-accent/30"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white text-lg font-medium">
                  {(user?.name ?? '用户').charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <div className="text-base font-medium text-[var(--color-text)]">
                  {user?.name ?? '未登录'}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </div>
              </div>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-primary-50 transition-colors"
                aria-label="关闭"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* 通知按钮 */}
          <button className="w-full flex items-center gap-3 px-4 py-3 text-[var(--color-text)] hover:bg-primary-50 transition-colors border-b border-[var(--color-border)]">
            <div className="relative">
              <Bell size={20} strokeWidth={1.5} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full ring-2 ring-surface" />
            </div>
            <span className="text-sm">通知</span>
          </button>

          {/* 更多导航项 */}
          {moreNavItems.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                更多功能
              </div>
              {moreNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 transition-colors ${
                      isActive
                        ? 'bg-accent/10 text-accent border-l-4 border-accent'
                        : 'text-[var(--color-text)] hover:bg-primary-50'
                    }`
                  }
                >
                  <item.icon size={20} strokeWidth={1.5} />
                  <span className="text-sm flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )}

          {/* 退出登录 */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors border-t border-[var(--color-border)]"
          >
            <LogOut size={20} strokeWidth={1.5} />
            <span className="text-sm">退出登录</span>
          </button>
        </div>
      )}

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-[var(--color-border)] z-30 lg:hidden safe-area-inset-bottom">
        <div className="h-full flex items-center justify-around px-2">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${
                  isActive
                    ? 'text-accent'
                    : 'text-[var(--color-text-muted)] active:scale-95'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2 : 1.5}
                      className="transition-all"
                    />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full ring-2 ring-surface" />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {getMobileLabel(item.label)}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* 更多按钮 */}
          <button
            ref={moreButtonRef}
            onClick={() => setShowMore(v => !v)}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${
              showMore
                ? 'text-accent'
                : 'text-[var(--color-text-muted)] active:scale-95'
            }`}
          >
            <MoreHorizontal
              size={22}
              strokeWidth={showMore ? 2 : 1.5}
              className="transition-all"
            />
            <span className={`text-[10px] font-medium ${showMore ? 'font-semibold' : ''}`}>
              更多
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
