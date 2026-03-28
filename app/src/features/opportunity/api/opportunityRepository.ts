import { supabase, type OpportunityLedger } from '@/lib/supabase'

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
