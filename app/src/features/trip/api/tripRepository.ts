import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export interface BusinessTrip {
  id: number
  opportunity_name: string
  customer_name: string
  start_time: string
  end_time: string
  reason: string
  employee_name: string
  employee_id: string
  department: string
}

type BusinessTripRow = Tables<'business_trips'>

function normalizeBusinessTrip(row: BusinessTripRow): BusinessTrip {
  return {
    id: row.id,
    opportunity_name: row.opportunity_name ?? '-',
    customer_name: row.customer_name ?? '-',
    start_time: row.start_time ?? '',
    end_time: row.end_time ?? '',
    reason: row.reason ?? '-',
    employee_name: row.employee_name ?? '-',
    employee_id: row.employee_id ?? '',
    department: row.department ?? '-',
  }
}

export async function fetchBusinessTrips() {
  const { data, error } = await supabase
    .from('business_trips')
    .select('*')
    .order('start_time', { ascending: false })

  if (error) throw error

  return (data ?? []).map(normalizeBusinessTrip)
}
