export interface OpportunitySnapshotItem {
  id: string
  snapshot_date: string
  region: string | null
  opportunity_attribute: string | null
  acquisition_channel: string | null
  project_name: string
  stage_label: string
  referrer: string | null
  market_owner: string | null
  progress_note: string | null
  win_probability: number | null
  expected_finish_date: string | null
  first_year_revenue: number | null
}
