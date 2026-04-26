import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildDataHref } from '@/app/config/constants'
import { DATA_MODULE_IDS, MODULE_NAV_CONFIG, isDataModuleId } from '@/app/config/modules'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { BizDataPage, PlanningPage } from '@/features/biz-data'
import { OrgDataPage } from '@/features/org'
import { OpportunityPage } from '@/features/opportunity'
import { AttendancePage } from '@/features/attendance'
import { TripPage } from '@/features/trip'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'

export function DataHubPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { enabledModuleIds } = useEnabledModules()

  const tabs = useMemo(() => {
    return DATA_MODULE_IDS.filter((tab) => enabledModuleIds.includes(tab))
  }, [enabledModuleIds])

  const requestedTabValue = searchParams.get('tab')
  const requestedTab = requestedTabValue && isDataModuleId(requestedTabValue) ? requestedTabValue : null
  const activeTab = tabs.includes(requestedTab ?? tabs[0]) ? (requestedTab ?? tabs[0]) : tabs[0]

  useEffect(() => {
    if (!activeTab) return
    if ((requestedTab ?? activeTab) !== activeTab) {
      navigate(buildDataHref(activeTab), { replace: true })
    }
  }, [activeTab, navigate, requestedTab])

  const tabItems = tabs.map((tab) => {
    const config = MODULE_NAV_CONFIG[tab]
    const Icon = config.icon

    return {
      key: tab,
      label: config.label,
      to: buildDataHref(tab),
      active: tab === activeTab,
      icon: <Icon size={16} strokeWidth={1.9} />,
    }
  })

  if (!activeTab) {
    return null
  }

  return (
    <TabbedPageShell
      tabs={tabItems}
      contentClassName={activeTab === 'biz-data' ? 'app-tab-shell__content-biz-data' : undefined}
    >
      {activeTab === 'biz-data' ? (
        <BizDataPage />
      ) : activeTab === 'planning' ? (
        <PlanningPage />
      ) : activeTab === 'opportunity' ? (
        <OpportunityPage />
      ) : activeTab === 'trip' ? (
        <TripPage />
      ) : activeTab === 'attendance' ? (
        <AttendancePage />
      ) : activeTab === 'org-data' ? (
        <OrgDataPage />
      ) : null}
    </TabbedPageShell>
  )
}
