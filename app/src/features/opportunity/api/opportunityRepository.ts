import { supabase } from '@/shared/lib/supabase'
import type { OpportunityLedger } from '../types'

export async function fetchOpportunityLedger(): Promise<OpportunityLedger[]> {
  const { data, error } = await supabase
    .from('opportunity_ledger')
    .select('*')
    .order('row_number', { ascending: true })

  if (error) {
    throw error
  }

  return (data as OpportunityLedger[]) ?? []
}
