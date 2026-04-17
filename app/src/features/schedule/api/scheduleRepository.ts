import { invokeTauri } from '@/shared/lib/tauri'

export type Period = 'morning' | 'afternoon' | 'evening'
export type ItemType = 'meeting' | 'business' | 'routine' | 'urgent'
const PERIOD_ORDER: Record<Period, number> = { morning: 0, afternoon: 1, evening: 2 }
const SCHEDULE_TIME_ZONE = 'Asia/Shanghai'

export interface ScheduleItem {
  id: string
  title: string
  description: string | null
  date: string
  period: Period
  start_time: string | null
  end_time: string | null
  type: ItemType | null
  location: string | null
  meeting_notes: string | null
  created_at: string
}

export interface ScheduleItemDraft {
  title: string
  description: string | null
  date: string
  period: Period
  start_time: string | null
  end_time: string | null
  type: ItemType
  location: string | null
}

function isPeriod(value: string | null): value is Period {
  return value === 'morning' || value === 'afternoon' || value === 'evening'
}

function derivePeriodFromTimeValue(timeValue: string | null) {
  if (!timeValue) return null

  const date = new Date(timeValue)
  if (Number.isNaN(date.getTime())) return null

  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(date))
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function resolveSchedulePeriod(period: string | null, startTime: string | null): Period {
  if (isPeriod(period)) return period

  const derivedPeriod = derivePeriodFromTimeValue(startTime)
  if (derivedPeriod) return derivedPeriod

  return 'morning'
}

function combineDateAndTime(date: string, timeValue: string | null) {
  if (!timeValue) return null

  const normalizedTime = timeValue.length === 5 ? `${timeValue}:00` : timeValue
  return `${date}T${normalizedTime}+08:00`
}

function compareScheduleItems(left: ScheduleItem, right: ScheduleItem) {
  const dateDiff = left.date.localeCompare(right.date)
  if (dateDiff !== 0) return dateDiff

  const periodDiff = PERIOD_ORDER[left.period] - PERIOD_ORDER[right.period]
  if (periodDiff !== 0) return periodDiff

  const leftTime = left.start_time ? new Date(left.start_time).getTime() : Number.MAX_SAFE_INTEGER
  const rightTime = right.start_time ? new Date(right.start_time).getTime() : Number.MAX_SAFE_INTEGER
  if (leftTime !== rightTime) return leftTime - rightTime

  return left.created_at.localeCompare(right.created_at)
}

function normalizeScheduleItem(row: ScheduleItem): ScheduleItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    date: row.date ?? '',
    period: resolveSchedulePeriod(row.period, row.start_time),
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    type: (row.type as ItemType | null) ?? null,
    location: row.location ?? null,
    meeting_notes: row.meeting_notes ?? null,
    created_at: row.created_at ?? '',
  }
}

export async function fetchScheduleItemsByRange(startDate: string, endDate: string) {
  const data = await invokeTauri<ScheduleItem[]>('schedule_list_by_range', {
    startDate,
    endDate,
  })

  return (data ?? []).map(normalizeScheduleItem).sort(compareScheduleItems)
}

export async function createScheduleItem(input: ScheduleItemDraft) {
  const payload = {
    title: input.title.trim(),
    description: input.description || null,
    date: input.date,
    period: input.period,
    start_time: combineDateAndTime(input.date, input.start_time),
    end_time: combineDateAndTime(input.date, input.end_time),
    type: input.type,
    location: input.location || null,
  }

  await invokeTauri<ScheduleItem>('schedule_create', { draft: payload })
}

export async function updateScheduleMeetingNotes(itemId: string, meetingNotes: string) {
  await invokeTauri('schedule_update_meeting_notes', {
    itemId,
    meetingNotes,
  })
}

export async function removeScheduleItem(itemId: string) {
  await invokeTauri('schedule_delete', { itemId })
}
