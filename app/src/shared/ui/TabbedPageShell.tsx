import type { ReactNode } from 'react'
import { SectionTabs, type SectionTabItem } from './SectionTabs'

interface TabbedPageShellProps {
  tabs: SectionTabItem[]
  children: ReactNode
  contentClassName?: string
}

export function TabbedPageShell({ tabs, children, contentClassName }: TabbedPageShellProps) {
  return (
    <section className="app-tab-shell">
      <div className="app-tab-shell__header">
        <SectionTabs tabs={tabs} />
      </div>
      <div className={['app-tab-shell__content', contentClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </section>
  )
}
