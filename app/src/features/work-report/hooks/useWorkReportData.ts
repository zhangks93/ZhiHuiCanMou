import { useCallback, useEffect, useState } from 'react'
import type { DropResult } from '@hello-pangea/dnd'
import {
  createWorkItem,
  fetchCurrentUserWorkItems,
  type WorkItem,
  type WorkItemLink,
  updateWorkItemPlacement,
} from '../api/workReportRepository'

function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

function parseDroppableId(id: string): { moduleId: string; status: string } {
  const [, moduleId, status] = id.split('-')
  return { moduleId: moduleId ?? '', status: status ?? 'todo' }
}

export function useWorkReportData() {
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const items = await fetchCurrentUserWorkItems()
    setWorkItems(items)
    return items
  }, [])

  useEffect(() => {
    let cancelled = false

    reload()
      .then((items) => {
        if (!cancelled) {
          setWorkItems(items)
          setLoading(false)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[WorkReport] Fetch failed:', error)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  const moveWorkItem = useCallback(async (result: DropResult) => {
    if (!result.destination) return

    const { draggableId, destination } = result
    const { moduleId, status } = parseDroppableId(destination.droppableId)
    const item = workItems.find((entry) => entry.id === draggableId)

    if (!item || (item.module_id === moduleId && item.status === status)) return

    setWorkItems((current) => current.map((entry) => (
      entry.id === draggableId ? { ...entry, module_id: moduleId, status } : entry
    )))

    const { error } = await updateWorkItemPlacement({
      workItemId: draggableId,
      moduleId,
      status,
    })

    if (error) {
      console.error('[WorkReport] Update failed:', error)
      void reload()
    }
  }, [reload, workItems])

  const submitWorkItem = useCallback(async (params: {
    moduleId: string
    title: string
    content: string
    links: WorkItemLink[]
    priority: string
  }) => {
    const { start, end } = getWeekRange()
    const { error } = await createWorkItem({
      moduleId: params.moduleId,
      title: params.title,
      content: params.content,
      links: params.links,
      priority: params.priority,
      periodStart: start,
      periodEnd: end,
    })

    if (error) {
      console.error('[WorkReport] Insert failed:', error)
      return false
    }

    await reload()
    return true
  }, [reload])

  return {
    workItems,
    loading,
    moveWorkItem,
    submitWorkItem,
  }
}
