import { useMemo, useState } from 'react'
import { useAsyncResource } from '@/shared/hooks/useAsyncResource'
import { fetchOpportunitySnapshotDates, fetchOpportunitySnapshotItems } from '../api/opportunityRepository'
import type { OpportunitySnapshotItem } from '../types'

export function useOpportunityData() {
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState('')

  const {
    data: snapshotDates,
    loading: datesLoading,
    error: datesError,
  } = useAsyncResource(fetchOpportunitySnapshotDates, [], {
    errorFallback: '商机快照日期加载失败',
  })

  const activeSnapshotDate = useMemo(() => {
    if (selectedSnapshotDate && snapshotDates?.includes(selectedSnapshotDate)) {
      return selectedSnapshotDate
    }
    return snapshotDates?.[0] ?? ''
  }, [selectedSnapshotDate, snapshotDates])

  const {
    data: rows,
    loading: rowsLoading,
    error: rowsError,
  } = useAsyncResource(
    () => fetchOpportunitySnapshotItems(activeSnapshotDate),
    [activeSnapshotDate],
    {
      enabled: Boolean(activeSnapshotDate),
      errorFallback: '商机数据加载失败',
    },
  )

  return {
    rows: (rows ?? []) as OpportunitySnapshotItem[],
    snapshotDates: snapshotDates ?? [],
    selectedSnapshotDate: activeSnapshotDate,
    setSelectedSnapshotDate,
    loading: datesLoading || rowsLoading,
    error: datesError ?? rowsError,
  }
}
