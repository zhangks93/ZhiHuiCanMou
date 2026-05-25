import { Sun, Sunset, Moon, type LucideIcon } from 'lucide-react'
import type { ItemType, Period } from '../api/scheduleRepository'

export const PERIOD_LABEL: Record<Period, string> = { morning: '上午', afternoon: '下午', evening: '晚上' }
export const PERIOD_ICON: Record<Period, LucideIcon> = { morning: Sun, afternoon: Sunset, evening: Moon }
export const TYPE_LABEL: Record<ItemType, string> = { meeting: '会议', business: '商务', routine: '例行', urgent: '紧急' }
export const TYPE_COLOR: Record<ItemType, string> = {
  meeting: 'bg-accent-100 text-accent-700',
  business: 'bg-primary-100 text-primary-700',
  routine: 'bg-gray-100 text-gray-600',
  urgent: 'bg-error-100 text-error-700',
}
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
