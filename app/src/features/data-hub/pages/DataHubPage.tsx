import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildDataHref } from '@/app/config/constants'
import { useEnabledModules } from '@/app/hooks/useEnabledModules'
import { BizDataPage } from '@/features/biz-data'
import { CompetitorPage } from '@/features/competitor'
import { OrgDataPage } from '@/features/org'
import { OpportunityPage } from '@/features/opportunity'
import { AttendancePage } from '@/features/attendance'
import { TripPage } from '@/features/trip'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'

const TAB_LABELS = {
  'org-data': '常用数据',
  'biz-data': '经营数据',
  competitor: '竞对档案',
  opportunity: '商机台账',
  trip: '出差管理',
  attendance: '考勤管理',
} as const

type DataTab = keyof typeof TAB_LABELS

export function DataHubPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { enabledModuleIds } = useEnabledModules()

  const tabs = useMemo(() => {
    const orderedTabs: DataTab[] = ['org-data', 'biz-data', 'competitor', 'opportunity', 'trip', 'attendance']
    return orderedTabs.filter((tab) => enabledModuleIds.includes(tab))
  }, [enabledModuleIds])

  const requestedTab = searchParams.get('tab') as DataTab | null
  const activeTab = tabs.includes(requestedTab ?? tabs[0]) ? (requestedTab ?? tabs[0]) : tabs[0]

  useEffect(() => {
    if (!activeTab) return
    if ((requestedTab ?? activeTab) !== activeTab) {
      navigate(buildDataHref(activeTab), { replace: true })
    }
  }, [activeTab, navigate, requestedTab])

  const tabItems = tabs.map((tab) => ({
    key: tab,
    label: TAB_LABELS[tab],
    to: buildDataHref(tab),
    active: tab === activeTab,
  }))

  if (!activeTab) {
    return null
  }

  return (
    <TabbedPageShell tabs={tabItems}>
      {activeTab === 'biz-data' ? (
        <BizDataPage />
      ) : activeTab === 'competitor' ? (
        <CompetitorPage />
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
