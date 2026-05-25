import { Suspense, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildWorkspaceHref } from '@/app/config/constants'
import { WORKSPACE_TAB_REGISTRY } from '@/app/config/moduleRegistry'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'
import { AppLoading } from '@/shared/ui/AppLoading'
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

  const registryEntry = activeTab ? WORKSPACE_TAB_REGISTRY[activeTab] : null
  const ActiveModule = registryEntry?.component

  return (
    <TabbedPageShell tabs={tabItems}>
      {ActiveModule ? (
        <Suspense fallback={<AppLoading variant="block" label="模块加载中..." />}>
          <ActiveModule />
        </Suspense>
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
