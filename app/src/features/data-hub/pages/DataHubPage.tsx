import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildDataHref } from '@/app/config/constants'
import { MODULE_NAV_CONFIG } from '@/app/config/modules'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { BizDataPage } from '@/features/biz-data'
import { OrgDataPage } from '@/features/org'
import { OpportunityPage } from '@/features/opportunity'
import { AttendancePage } from '@/features/attendance'
import { TripPage } from '@/features/trip'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'

const DATA_TABS = ['biz-data', 'opportunity', 'trip', 'attendance', 'org-data'] as const

type DataTab = (typeof DATA_TABS)[number]

export function DataHubPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { enabledModuleIds } = useEnabledModules()

  const tabs = useMemo(() => {
    return DATA_TABS.filter((tab) => enabledModuleIds.includes(tab))
  }, [enabledModuleIds])

  const requestedTab = searchParams.get('tab') as DataTab | null
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
    <TabbedPageShell tabs={tabItems}>
      {activeTab === 'biz-data' ? (
        <BizDataPage />
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
