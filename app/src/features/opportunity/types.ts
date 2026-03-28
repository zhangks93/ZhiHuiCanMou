export interface OpportunityLedger {
  id: string
  snapshot_id: string
  snapshot_date: string
  sheet_name: string
  row_number: number
  schema_version: string
  project_group: string | null
  project_name: string
  stage_code: string
  stage_label: string
  progress_note: string | null
  target_date: string | null
  target_date_raw: string | null
  first_year_revenue: number | null
  first_year_revenue_raw: string | null
  created_at: string
  updated_at: string
}
