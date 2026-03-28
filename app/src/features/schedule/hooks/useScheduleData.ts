import { useCallback, useEffect, useState } from 'react'
import {
  createScheduleItem,
  fetchScheduleItemsByRange,
  removeScheduleItem,
  updateScheduleMeetingNotes,
  type ScheduleItem,
  type ScheduleItemDraft,
} from '../api/scheduleRepository'

export function useScheduleData(startDate: string, endDate: string) {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const nextItems = await fetchScheduleItemsByRange(startDate, endDate)
    setItems(nextItems)
    return nextItems
  }, [endDate, startDate])

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    reload()
      .then((nextItems) => {
        if (!cancelled) {
          setItems(nextItems)
          setLoading(false)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[Schedule] Fetch failed:', error)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  const addScheduleItem = useCallback(async (draft: ScheduleItemDraft) => {
    await createScheduleItem(draft)
    await reload()
  }, [reload])

  const saveMeetingNotes = useCallback(async (itemId: string, notes: string) => {
    await updateScheduleMeetingNotes(itemId, notes)
    await reload()
  }, [reload])

  const deleteScheduleItem = useCallback(async (itemId: string) => {
    await removeScheduleItem(itemId)
    await reload()
  }, [reload])

  return {
    items,
    loading,
    addScheduleItem,
    saveMeetingNotes,
    deleteScheduleItem,
  }
}
