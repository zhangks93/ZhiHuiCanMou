import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildWorkspaceHref } from '@/app/config/constants'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { LinksPage } from '@/features/links'
import { SchedulePage } from '@/features/schedule'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'

const TAB_LABELS = {
  schedule: '日程',
  links: '链接',
} as const

type WorkspaceTab = keyof typeof TAB_LABELS

export function WorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { enabledModuleIds } = useEnabledModules()

  const tabs = useMemo(() => {
    const availableTabs: WorkspaceTab[] = []

    if (enabledModuleIds.includes('schedule')) availableTabs.push('schedule')
    if (enabledModuleIds.includes('links')) availableTabs.push('links')

    return availableTabs
  }, [enabledModuleIds])

  const requestedTab = searchParams.get('tab') as WorkspaceTab | null
  const activeTab = requestedTab && tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? null)

  useEffect(() => {
    if (activeTab && requestedTab !== activeTab) {
      navigate(buildWorkspaceHref(activeTab), { replace: true })
    }
  }, [activeTab, navigate, requestedTab])

  const tabItems = tabs.map((tab) => ({
    key: tab,
    label: TAB_LABELS[tab],
    to: buildWorkspaceHref(tab),
    active: tab === activeTab,
  }))

  return (
    <TabbedPageShell tabs={tabItems}>
      {activeTab === 'schedule' ? (
        <SchedulePage />
      ) : activeTab === 'links' ? (
        <LinksPage />
      ) : (
        <section className="app-section-card app-section-card-muted p-5 sm:p-6">
          <div className="app-empty-state">
            <p className="text-body">当前没有可用的工作台模块</p>
          </div>
        </section>
      )}
    </TabbedPageShell>
  )
}
