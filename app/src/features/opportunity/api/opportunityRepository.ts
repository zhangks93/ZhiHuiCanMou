import { supabase } from '@/shared/lib/supabase'
import type { OpportunitySnapshotItem } from '../types'

export async function fetchOpportunitySnapshotDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('opportunity_snapshot_items')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })

  if (error) {
    throw error
  }

  const dates = (data ?? []).map((row) => row.snapshot_date).filter(Boolean)
  return [...new Set(dates)]
}

export async function fetchOpportunitySnapshotItems(snapshotDate: string): Promise<OpportunitySnapshotItem[]> {
  const { data, error } = await supabase
    .from('opportunity_snapshot_items')
    .select('*')
    .eq('snapshot_date', snapshotDate)
    .order('win_probability', { ascending: false, nullsFirst: false })
    .order('region', { ascending: true, nullsFirst: false })
    .order('opportunity_attribute', { ascending: true, nullsFirst: false })
    .order('project_name', { ascending: true })

  if (error) {
    throw error
  }

  return (data as OpportunitySnapshotItem[]) ?? []
}
