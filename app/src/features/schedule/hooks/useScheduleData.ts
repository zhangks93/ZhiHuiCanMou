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
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
    }

    try {
      const nextItems = await fetchScheduleItemsByRange(startDate, endDate)
      setItems(nextItems)
      setError(null)
      setLoading(false)
      return nextItems
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '日程加载失败，请稍后重试。'
      setError(message)
      setLoading(false)
      throw caughtError
    }
  }, [endDate, startDate])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const nextItems = await fetchScheduleItemsByRange(startDate, endDate)
        if (!cancelled) {
          setItems(nextItems)
          setError(null)
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Schedule] Fetch failed:', error)
          setError(error instanceof Error ? error.message : '日程加载失败，请稍后重试。')
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
    try {
      await createScheduleItem(draft)
      await reload(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : '日程保存失败，请稍后重试。')
      throw error
    }
  }, [reload])

  const saveMeetingNotes = useCallback(async (itemId: string, notes: string) => {
    try {
      await updateScheduleMeetingNotes(itemId, notes)
      await reload(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : '会议纪要保存失败，请稍后重试。')
      throw error
    }
  }, [reload])

  const deleteScheduleItem = useCallback(async (itemId: string) => {
    try {
      await removeScheduleItem(itemId)
      await reload(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : '日程删除失败，请稍后重试。')
      throw error
    }
  }, [reload])

  return {
    items,
    loading,
    error,
    addScheduleItem,
    saveMeetingNotes,
    deleteScheduleItem,
  }
}
