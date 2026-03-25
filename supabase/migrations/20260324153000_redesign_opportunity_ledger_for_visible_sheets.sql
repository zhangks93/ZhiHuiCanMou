do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'opportunity_ledger'
      and c.relkind = 'r'
  ) and not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'opportunity_ledger_legacy_backup'
      and c.relkind = 'r'
  ) then
    alter table public.opportunity_ledger rename to opportunity_ledger_legacy_backup;
  end if;
end
$$;

create table if not exists public.opportunity_ledger_snapshots (
  id uuid primary key default gen_random_uuid(),
  sheet_name text not null,
  sheet_index integer not null default 1,
  snapshot_date date not null,
  source_file_name text not null,
  source_file_path text,
  row_count integer not null default 0,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (snapshot_date, sheet_name, source_file_name)
);

create table if not exists public.opportunity_ledger (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.opportunity_ledger_snapshots(id) on delete cascade,
  snapshot_date date not null,
  sheet_name text not null,
  row_number integer not null,
  schema_version text not null default 'visible_v1',
  project_group text,
  project_name text not null,
  stage_code text not null,
  stage_label text not null,
  progress_note text,
  target_date date,
  target_date_raw text,
  first_year_revenue numeric,
  first_year_revenue_raw text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id, row_number),
  check (schema_version = 'visible_v1'),
  check (
    stage_code = any (
      array[
        'lead'::text,
        'opportunity'::text,
        'internal_approval'::text,
        'customer_approval'::text,
        'contracted'::text,
        'unknown'::text
      ]
    )
  )
);

create index if not exists opportunity_ledger_snapshot_date_idx
  on public.opportunity_ledger (snapshot_date desc);

create index if not exists opportunity_ledger_stage_code_idx
  on public.opportunity_ledger (stage_code);

create index if not exists opportunity_ledger_project_group_idx
  on public.opportunity_ledger (project_group);

create index if not exists opportunity_ledger_snapshot_id_idx
  on public.opportunity_ledger (snapshot_id);

create index if not exists opportunity_ledger_snapshots_snapshot_date_idx
  on public.opportunity_ledger_snapshots (snapshot_date desc);

alter table public.opportunity_ledger enable row level security;
drop policy if exists "allow all access to opportunity_ledger" on public.opportunity_ledger;
create policy "allow all access to opportunity_ledger"
  on public.opportunity_ledger
  for all
  using (true)
  with check (true);

alter table public.opportunity_ledger_snapshots enable row level security;
drop policy if exists "allow all access to opportunity_ledger_snapshots" on public.opportunity_ledger_snapshots;
create policy "allow all access to opportunity_ledger_snapshots"
  on public.opportunity_ledger_snapshots
  for all
  using (true)
  with check (true);

comment on table public.opportunity_ledger_snapshots is 'Visible-sheet import snapshots for the opportunity ledger workbook';
comment on table public.opportunity_ledger is 'Row-level opportunity records parsed from visible workbook sheets';
comment on column public.opportunity_ledger.target_date_raw is 'Raw target-date cell value from Excel';
comment on column public.opportunity_ledger.first_year_revenue_raw is 'Raw first-year revenue cell value from Excel';
