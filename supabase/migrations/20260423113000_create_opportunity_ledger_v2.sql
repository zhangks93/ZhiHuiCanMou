create table if not exists public.opportunity_ledger_v2 (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  sheet_name text not null,
  row_number integer not null,
  region text,
  opportunity_attribute text,
  acquisition_channel text,
  project_name text not null,
  stage_label text not null,
  referrer text,
  market_owner text,
  progress_note text,
  expected_finish_date date,
  first_year_revenue text,
  unique (snapshot_date, sheet_name, row_number)
);

create index if not exists opportunity_ledger_v2_snapshot_date_idx
  on public.opportunity_ledger_v2 (snapshot_date desc);

create index if not exists opportunity_ledger_v2_stage_label_idx
  on public.opportunity_ledger_v2 (stage_label);

create index if not exists opportunity_ledger_v2_region_idx
  on public.opportunity_ledger_v2 (region);

create index if not exists opportunity_ledger_v2_market_owner_idx
  on public.opportunity_ledger_v2 (market_owner);

create index if not exists opportunity_ledger_v2_project_name_idx
  on public.opportunity_ledger_v2 (project_name);

alter table public.opportunity_ledger_v2 enable row level security;
drop policy if exists "authenticated read access to opportunity_ledger_v2" on public.opportunity_ledger_v2;
drop policy if exists "allow all access to opportunity_ledger_v2" on public.opportunity_ledger_v2;
create policy "authenticated read access to opportunity_ledger_v2"
  on public.opportunity_ledger_v2
  for select
  to authenticated
  using (auth.uid() is not null);

comment on table public.opportunity_ledger_v2 is 'Opportunity records parsed from the latest workbook, keeping Excel fields plus snapshot metadata';
comment on column public.opportunity_ledger_v2.snapshot_date is 'Snapshot date parsed from sheet name using academic-year rules';
comment on column public.opportunity_ledger_v2.first_year_revenue is 'Original first-year revenue text from Excel';
