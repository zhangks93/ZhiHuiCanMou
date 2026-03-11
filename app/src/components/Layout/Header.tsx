import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Menu, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/constants'

type HeaderProps = {
  onMenuClick?: () => void
  userName?: string | null
  avatarUrl?: string | null
}

export function Header({ onMenuClick, userName, avatarUrl }: HeaderProps) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [date] = useState(() =>
    new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    setDropdownOpen(false)
    navigate(ROUTES.LOGIN)
  }

  return (
    <header className="h-14 bg-primary border-b border-primary-dark/30 flex items-center px-4 lg:px-6 fixed top-0 left-0 right-0 z-50 shadow-card">
      {/* 移动端：仅显示 logo，无操作元素 */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white text-sm font-semibold shadow-inner-soft">
          智
        </div>
        <span className="font-semibold text-white text-base font-serif">智汇参谋</span>
      </div>

      {/* 桌面端：保留原有布局 */}
      <button
        className="hidden lg:block p-2 -ml-2 text-primary-200 hover:bg-primary-light/50 rounded-lg transition-colors"
        onClick={onMenuClick}
        aria-label="打开菜单"
      >
        <Menu size={20} strokeWidth={1.5} />
      </button>
      <div className="hidden lg:flex items-center gap-2.5 ml-2">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white text-sm font-semibold shadow-inner-soft">
          智
        </div>
        <span className="font-semibold text-white text-base font-serif">智汇参谋</span>
      </div>
      <div className="flex-1" />
      <div className="hidden lg:flex items-center gap-3 lg:gap-4">
        <span className="text-primary-200/90 text-sm hidden sm:block">{date}</span>
        <button className="relative p-2 rounded-lg text-primary-200 hover:bg-primary-light/50 transition-colors">
          <Bell size={18} strokeWidth={1.5} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full ring-2 ring-primary" />
        </button>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 cursor-pointer rounded-lg p-1 -mr-1 hover:bg-primary-light/50 transition-colors"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName ?? '用户头像'}
                className="w-8 h-8 rounded-lg object-cover ring-1 ring-primary-200/30"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white text-sm font-medium">
                {(userName ?? '用户').charAt(0)}
              </div>
            )}
            <span className="text-white text-sm hidden md:inline">
              {userName ?? '未登录'}
            </span>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 py-1 w-40 bg-surface rounded-lg shadow-card-hover border border-[var(--color-border)] z-50 animate-fade-in">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] hover:bg-primary-50 rounded mx-1 transition-colors"
              >
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
