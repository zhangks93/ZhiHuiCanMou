import { supabase } from '@/shared/lib/supabase'
import type { Tables } from '@/shared/lib/database.types'

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

export type FeeEffectBatch = Tables<'fee_effect_import_batches'>
export type FeeEffectPersonSummary = Tables<'fee_effect_person_summary'>
export type FeeEffectProjectSummary = Tables<'fee_effect_project_summary'>
export type FeeEffectPersonTravelProject = Tables<'fee_effect_person_travel_projects'>
export type FeeEffectPersonHospitalityProject = Tables<'fee_effect_person_hospitality_projects'>
export type EduOrgHierarchyRow = Pick<Tables<'edu_org_hierarchy'>, 'node_name' | 'level_0' | 'level_1' | 'level_2'>

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

export async function fetchFeeEffectBatches(): Promise<FeeEffectBatch[]> {
  const { data, error } = await supabase
    .from('fee_effect_import_batches')
    .select('*')
    .order('imported_at', { ascending: false })

  if (error) throw error

  return data ?? []
}

export async function fetchEduOrgHierarchy(): Promise<EduOrgHierarchyRow[]> {
  const { data, error } = await supabase
    .from('edu_org_hierarchy')
    .select('node_name, level_0, level_1, level_2')
    .order('node_name')

  if (error) throw error

  return data ?? []
}

export async function fetchFeeEffectPersonSummaries(batchId: string): Promise<FeeEffectPersonSummary[]> {
  const { data, error } = await supabase
    .from('fee_effect_person_summary')
    .select('*')
    .eq('batch_id', batchId)
    .order('total_expense_amount', { ascending: false, nullsFirst: false })

  if (error) throw error

  return data ?? []
}

export async function fetchFeeEffectProjectSummaries(batchId: string): Promise<FeeEffectProjectSummary[]> {
  const { data, error } = await supabase
    .from('fee_effect_project_summary')
    .select('*')
    .eq('batch_id', batchId)
    .order('total_expense_amount', { ascending: false, nullsFirst: false })

  if (error) throw error

  return data ?? []
}

export async function fetchFeeEffectPersonTravelProjects(batchId: string): Promise<FeeEffectPersonTravelProject[]> {
  const { data, error } = await supabase
    .from('fee_effect_person_travel_projects')
    .select('*')
    .eq('batch_id', batchId)
    .order('travel_total_amount', { ascending: false, nullsFirst: false })

  if (error) throw error

  return data ?? []
}

export async function fetchFeeEffectPersonHospitalityProjects(batchId: string): Promise<FeeEffectPersonHospitalityProject[]> {
  const { data, error } = await supabase
    .from('fee_effect_person_hospitality_projects')
    .select('*')
    .eq('batch_id', batchId)
    .order('hospitality_total_amount', { ascending: false, nullsFirst: false })

  if (error) throw error

  return data ?? []
}
