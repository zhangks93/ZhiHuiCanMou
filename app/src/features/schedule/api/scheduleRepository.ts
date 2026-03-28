import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'

export type Period = 'morning' | 'afternoon' | 'evening'
export type ItemType = 'meeting' | 'business' | 'routine' | 'urgent'

export interface ScheduleItem {
  id: string
  title: string
  description: string | null
  date: string
  period: Period
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
  type: ItemType
  location: string | null
}

type ScheduleRow = Tables<'schedule_items'>

function normalizeScheduleItem(row: ScheduleRow): ScheduleItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    date: row.date ?? '',
    period: (row.period ?? 'morning') as Period,
    type: (row.type as ItemType | null) ?? null,
    location: row.location ?? null,
    meeting_notes: row.meeting_notes ?? null,
    created_at: row.created_at ?? '',
  }
}

export async function fetchScheduleItemsByRange(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('schedule_items')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('period')

  if (error) throw error

  return (data ?? []).map(normalizeScheduleItem)
}

export async function createScheduleItem(input: ScheduleItemDraft) {
  const payload: TablesInsert<'schedule_items'> = {
    title: input.title.trim(),
    description: input.description || null,
    date: input.date,
    period: input.period,
    type: input.type,
    location: input.location || null,
  }

  const { error } = await supabase.from('schedule_items').insert(payload)
  if (error) throw error
}

export async function updateScheduleMeetingNotes(itemId: string, meetingNotes: string) {
  const payload: TablesUpdate<'schedule_items'> = {
    meeting_notes: meetingNotes || null,
  }

  const { error } = await supabase
    .from('schedule_items')
    .update(payload)
    .eq('id', itemId)

  if (error) throw error
}

export async function removeScheduleItem(itemId: string) {
  const { error } = await supabase
    .from('schedule_items')
    .delete()
    .eq('id', itemId)

  if (error) throw error
}
