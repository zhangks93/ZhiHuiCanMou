create table if not exists public.opportunity_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  region text,
  opportunity_attribute text,
  acquisition_channel text,
  project_name text not null,
  stage_label text not null,
  referrer text,
  market_owner text,
  progress_note text,
  expected_finish_date date,
  first_year_revenue numeric
);

create index if not exists opportunity_snapshot_items_snapshot_date_idx
  on public.opportunity_snapshot_items (snapshot_date desc);

create index if not exists opportunity_snapshot_items_stage_label_idx
  on public.opportunity_snapshot_items (stage_label);

create index if not exists opportunity_snapshot_items_region_idx
  on public.opportunity_snapshot_items (region);

create index if not exists opportunity_snapshot_items_market_owner_idx
  on public.opportunity_snapshot_items (market_owner);

create index if not exists opportunity_snapshot_items_project_name_idx
  on public.opportunity_snapshot_items (project_name);

alter table public.opportunity_snapshot_items enable row level security;

drop policy if exists "authenticated read access to opportunity_snapshot_items" on public.opportunity_snapshot_items;
drop policy if exists "allow all access to opportunity_snapshot_items" on public.opportunity_snapshot_items;
create policy "authenticated read access to opportunity_snapshot_items"
  on public.opportunity_snapshot_items
  for select
  to authenticated
  using (auth.uid() is not null);

comment on table public.opportunity_snapshot_items is 'Opportunity snapshot rows imported from the simplified workbook structure';
comment on column public.opportunity_snapshot_items.snapshot_date is 'Snapshot date parsed from sheet name using academic-year rules';
comment on column public.opportunity_snapshot_items.first_year_revenue is 'Parsed numeric first-year revenue from Excel text';
