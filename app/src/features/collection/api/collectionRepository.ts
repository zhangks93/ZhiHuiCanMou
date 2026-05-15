import { supabase } from '@/shared/lib/supabase'
import type { Tables } from '@/shared/lib/database.types'

export type CollectionReceivableRow = Tables<'edu_collection_receivables'>

const COLLECTION_SELECT = [
  'id',
  'period_label',
  'row_order',
  'item_name',
  'parent_item_name',
  'business_category',
  'org_tag',
  'prior_school_year_receivable',
  'current_school_year_new_receivable',
  'current_school_year_collection_amount',
  'remaining_receivable',
  'collection_rate',
  'growth_base_label',
  'analysis_level_2',
  'analysis_level_1',
  'permission_people',
  'source_file_name',
  'source_sheet_name',
  'imported_at',
  'created_at',
].join(', ')

export async function fetchAvailableCollectionPeriods(): Promise<string[]> {
  const { data, error } = await supabase
    .from('edu_collection_receivables')
    .select('period_label, row_order')
    .order('row_order')

  if (error) throw error

  return [...new Set((data ?? []).map((item) => item.period_label).filter(Boolean))]
}

export async function fetchCollectionReceivables(periodLabel: string): Promise<CollectionReceivableRow[]> {
  const { data, error } = await supabase
    .from('edu_collection_receivables')
    .select(COLLECTION_SELECT)
    .eq('period_label', periodLabel)
    .order('row_order')

  if (error) throw error

  return (data ?? []) as unknown as CollectionReceivableRow[]
}
