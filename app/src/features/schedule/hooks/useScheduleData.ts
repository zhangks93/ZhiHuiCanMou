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

  const reload = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
    }

    const nextItems = await fetchScheduleItemsByRange(startDate, endDate)
    setItems(nextItems)
    setLoading(false)
    return nextItems
  }, [endDate, startDate])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const nextItems = await fetchScheduleItemsByRange(startDate, endDate)
        if (!cancelled) {
          setItems(nextItems)
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Schedule] Fetch failed:', error)
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [endDate, startDate])

  const addScheduleItem = useCallback(async (draft: ScheduleItemDraft) => {
    await createScheduleItem(draft)
    await reload(true)
  }, [reload])

  const saveMeetingNotes = useCallback(async (itemId: string, notes: string) => {
    await updateScheduleMeetingNotes(itemId, notes)
    await reload(true)
  }, [reload])

  const deleteScheduleItem = useCallback(async (itemId: string) => {
    await removeScheduleItem(itemId)
    await reload(true)
  }, [reload])

  return {
    items,
    loading,
    addScheduleItem,
    saveMeetingNotes,
    deleteScheduleItem,
  }
}
