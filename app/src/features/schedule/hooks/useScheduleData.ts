import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { logger } from '@/shared/lib/logger'
import {
  createScheduleItem,
  exportScheduleTransferPayload,
  fetchScheduleItemsByRange,
  importFeishuScheduleWorkbook,
  importScheduleTransferPayload,
  removeScheduleItem,
  updateScheduleMeetingNotes,
  type ScheduleImportResult,
  type ScheduleItem,
  type ScheduleItemDraft,
  type ScheduleTransferPayload,
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
      const message = getErrorMessage(caughtError, '日程加载失败，请稍后重试。')
      setError(message)
      setLoading(false)
      throw caughtError
    }
  }, [endDate, startDate])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      try {
        const nextItems = await fetchScheduleItemsByRange(startDate, endDate)
        if (!cancelled) {
          setItems(nextItems)
          setError(null)
        }
      } catch (caughtError) {
        if (!cancelled) {
          logger.error('Schedule fetch failed', caughtError)
          setError(getErrorMessage(caughtError, '日程加载失败，请稍后重试。'))
        }
      } finally {
        if (!cancelled) {
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
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '日程保存失败，请稍后重试。'))
      throw caughtError
    }
  }, [reload])

  const saveMeetingNotes = useCallback(async (itemId: string, notes: string) => {
    try {
      await updateScheduleMeetingNotes(itemId, notes)
      await reload(true)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '会议纪要保存失败，请稍后重试。'))
      throw caughtError
    }
  }, [reload])

  const deleteScheduleItem = useCallback(async (itemId: string) => {
    try {
      await removeScheduleItem(itemId)
      await reload(true)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '日程删除失败，请稍后重试。'))
      throw caughtError
    }
  }, [reload])

  const importScheduleWorkbook = useCallback(async (fileName: string, bytes: number[]) => {
    try {
      const result = await importFeishuScheduleWorkbook(fileName, bytes)
      await reload(true)
      return result
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '飞书日程导入失败，请稍后重试。'))
      throw caughtError
    }
  }, [reload])

  const buildTransferPayload = useCallback(async (
    itemIds: string[],
    senderUserId: string,
    senderName: string,
  ) => {
    try {
      return await exportScheduleTransferPayload(itemIds, senderUserId, senderName)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '日程分享导出失败，请稍后重试。'))
      throw caughtError
    }
  }, [])

  const importTransferPayload = useCallback(async (payload: ScheduleTransferPayload): Promise<ScheduleImportResult> => {
    try {
      const result = await importScheduleTransferPayload(payload)
      await reload(true)
      return result
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '共享日程导入失败，请稍后重试。'))
      throw caughtError
    }
  }, [reload])

  return {
    items,
    loading,
    error,
    addScheduleItem,
    saveMeetingNotes,
    deleteScheduleItem,
    importScheduleWorkbook,
    buildTransferPayload,
    importTransferPayload,
  }
}
