import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface SectionTabItem {
  key: string
  label: string
  to: string
  active: boolean
  icon?: ReactNode
}

interface SectionTabsProps {
  tabs: SectionTabItem[]
}

export function SectionTabs({ tabs }: SectionTabsProps) {
  return (
    <div className="app-tab-list" role="tablist" aria-label="页面标签导航">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={tab.to}
            role="tab"
            aria-selected={tab.active}
            className={[
              'app-tab-item',
              tab.active
                ? 'app-tab-item-active'
                : 'app-tab-item-idle',
            ].join(' ')}
          >
            {tab.icon ? <span className="app-tab-item__icon">{tab.icon}</span> : null}
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
