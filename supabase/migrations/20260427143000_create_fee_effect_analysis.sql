drop view if exists public.fee_effect_person_project_hospitality_summary;
drop view if exists public.fee_effect_person_project_travel_summary;
drop view if exists public.fee_effect_project_summary;
drop view if exists public.fee_effect_person_summary;

drop table if exists public.fee_effect_project_signing_lines cascade;
drop table if exists public.fee_effect_hospitality_lines cascade;
drop table if exists public.fee_effect_travel_lines cascade;
drop table if exists public.fee_effect_projects cascade;
drop table if exists public.fee_effect_people cascade;

create table if not exists public.fee_effect_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  source_file_hash text not null,
  period_start text not null,
  period_end text not null,
  person_summary_row_count integer not null default 0,
  person_travel_row_count integer not null default 0,
  person_hospitality_row_count integer not null default 0,
  project_summary_row_count integer not null default 0,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.fee_effect_person_summary (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.fee_effect_import_batches(id) on delete cascade,
  department text,
  person_name text not null,
  signing_revenue_amount numeric not null default 0,
  signing_profit_amount numeric not null default 0,
  travel_transportation_amount numeric not null default 0,
  travel_lodging_amount numeric not null default 0,
  travel_allowance_amount numeric not null default 0,
  travel_total_amount numeric not null default 0,
  hospitality_total_amount numeric not null default 0,
  total_expense_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (batch_id, person_name, department)
);

create table if not exists public.fee_effect_person_travel_projects (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.fee_effect_import_batches(id) on delete cascade,
  person_name text not null,
  department text,
  mdm_project_name text not null,
  travel_transportation_amount numeric not null default 0,
  travel_lodging_amount numeric not null default 0,
  travel_allowance_amount numeric not null default 0,
  travel_total_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (batch_id, person_name, department, mdm_project_name)
);

create table if not exists public.fee_effect_person_hospitality_projects (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.fee_effect_import_batches(id) on delete cascade,
  person_name text not null,
  department text,
  mdm_project_name text not null,
  hospitality_type text not null,
  guest_count numeric not null default 0,
  hospitality_total_amount numeric not null default 0,
  per_capita_amount numeric,
  created_at timestamptz not null default now(),
  unique (batch_id, person_name, department, mdm_project_name, hospitality_type)
);

create table if not exists public.fee_effect_project_summary (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.fee_effect_import_batches(id) on delete cascade,
  project_tag text not null,
  region text,
  launch_date date,
  first_year_contract_amount numeric not null default 0,
  first_year_profit_amount numeric not null default 0,
  travel_transportation_amount numeric not null default 0,
  travel_lodging_amount numeric not null default 0,
  travel_allowance_amount numeric not null default 0,
  travel_total_amount numeric not null default 0,
  hospitality_total_amount numeric not null default 0,
  paid_market_bonus_amount numeric not null default 0,
  total_expense_amount numeric not null default 0,
  first_year_roi numeric,
  created_at timestamptz not null default now(),
  unique (batch_id, project_tag)
);

create index if not exists idx_fee_effect_batches_imported_at
  on public.fee_effect_import_batches(imported_at desc);
create index if not exists idx_fee_effect_person_summary_batch_expense
  on public.fee_effect_person_summary(batch_id, total_expense_amount desc);
create index if not exists idx_fee_effect_person_travel_batch_amount
  on public.fee_effect_person_travel_projects(batch_id, travel_total_amount desc);
create index if not exists idx_fee_effect_person_hospitality_batch_amount
  on public.fee_effect_person_hospitality_projects(batch_id, hospitality_total_amount desc);
create index if not exists idx_fee_effect_project_summary_batch_expense
  on public.fee_effect_project_summary(batch_id, total_expense_amount desc);

alter table public.fee_effect_import_batches enable row level security;
alter table public.fee_effect_person_summary enable row level security;
alter table public.fee_effect_person_travel_projects enable row level security;
alter table public.fee_effect_person_hospitality_projects enable row level security;
alter table public.fee_effect_project_summary enable row level security;
alter table public.business_trips enable row level security;

drop policy if exists fee_effect_import_batches_select_authenticated on public.fee_effect_import_batches;
create policy fee_effect_import_batches_select_authenticated
  on public.fee_effect_import_batches
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists fee_effect_person_summary_select_authenticated on public.fee_effect_person_summary;
create policy fee_effect_person_summary_select_authenticated
  on public.fee_effect_person_summary
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists fee_effect_person_travel_projects_select_authenticated on public.fee_effect_person_travel_projects;
create policy fee_effect_person_travel_projects_select_authenticated
  on public.fee_effect_person_travel_projects
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists fee_effect_person_hospitality_projects_select_authenticated on public.fee_effect_person_hospitality_projects;
create policy fee_effect_person_hospitality_projects_select_authenticated
  on public.fee_effect_person_hospitality_projects
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists fee_effect_project_summary_select_authenticated on public.fee_effect_project_summary;
create policy fee_effect_project_summary_select_authenticated
  on public.fee_effect_project_summary
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists business_trips_select_authenticated on public.business_trips;
create policy business_trips_select_authenticated
  on public.business_trips
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline
