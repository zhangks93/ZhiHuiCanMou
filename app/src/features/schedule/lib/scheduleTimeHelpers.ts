import type { Period, ScheduleItem } from '../api/scheduleRepository'

export const SCHEDULE_TIME_ZONE = 'Asia/Shanghai'
export const PERIOD_HOUR_OPTIONS: Record<Period, string[]> = {
  morning: Array.from({ length: 12 }, (_, index) => String(index).padStart(2, '0')),
  afternoon: Array.from({ length: 6 }, (_, index) => String(index + 12).padStart(2, '0')),
  evening: Array.from({ length: 6 }, (_, index) => String(index + 18).padStart(2, '0')),
}
export const MINUTE_OPTIONS = ['00', '15', '30', '45']

export function getWeekDates(refDate: Date): Date[] {
  const date = new Date(refDate)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)

  return Array.from({ length: 7 }, (_, index) => {
    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + index)
    return nextDate
  })
}

export function fmtDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isSameDay(left: Date, right: Date) {
  return fmtDate(left) === fmtDate(right)
}

export function derivePeriodFromClock(timeValue: string): Period | null {
  if (!timeValue) return null

  const [hourValue] = timeValue.split(':')
  const hour = Number(hourValue)
  if (Number.isNaN(hour)) return null

  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function parseClockValue(timeValue: string) {
  if (!timeValue) return { hour: '', minute: '' }

  const [hour = '', minute = ''] = timeValue.split(':')
  return { hour, minute }
}

export function joinClockValue(hour: string, minute: string) {
  if (!hour && !minute) return ''
  if (!hour || !minute) return `${hour}:${minute}`
  return `${hour}:${minute}`
}

export function isHourIncluded(hour: string, period: Period) {
  return PERIOD_HOUR_OPTIONS[period].includes(hour)
}

export function alignTimeToPeriod(timeValue: string, period: Period) {
  if (!timeValue) return ''

  const { hour, minute } = parseClockValue(timeValue)
  if (!hour || !isHourIncluded(hour, period)) return ''

  return joinClockValue(hour, MINUTE_OPTIONS.includes(minute) ? minute : '00')
}

export function formatTimeValue(timeValue: string | null) {
  if (!timeValue) return null

  const date = new Date(timeValue)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: SCHEDULE_TIME_ZONE,
  })
}

export function formatTimeRange(item: ScheduleItem) {
  const startTime = formatTimeValue(item.start_time)
  const endTime = formatTimeValue(item.end_time)

  if (startTime && endTime) return `${startTime} - ${endTime}`
  return startTime || endTime || null
}
