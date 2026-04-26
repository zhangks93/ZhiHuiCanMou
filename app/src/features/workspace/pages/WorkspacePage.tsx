import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildWorkspaceHref } from '@/app/config/constants'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { ManagerBriefingPage } from '@/features/dashboard'
import { LinksPage } from '@/features/links'
import { ScheduleInboxPage, SchedulePage } from '@/features/schedule'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'
import { WORKSPACE_TAB_LABELS, getWorkspaceTabs, type WorkspaceTab } from '../workspaceTabs'

export function WorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { enabledModuleIds } = useEnabledModules()

  const tabs = useMemo(() => {
    return getWorkspaceTabs(enabledModuleIds)
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
    label: WORKSPACE_TAB_LABELS[tab],
    to: buildWorkspaceHref(tab),
    active: tab === activeTab,
  }))

  return (
    <TabbedPageShell tabs={tabItems}>
      {activeTab === 'briefing' ? (
        <ManagerBriefingPage />
      ) : activeTab === 'schedule' ? (
        <SchedulePage />
      ) : activeTab === 'inbox' ? (
        <ScheduleInboxPage />
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
