create table if not exists public.edu_collection_receivables (
  id uuid primary key default gen_random_uuid(),
  period_label text not null,
  row_order integer not null,
  item_name text not null,
  parent_item_name text,
  business_category text,
  org_tag text,
  prior_school_year_receivable numeric(14,2) not null default 0,
  current_school_year_new_receivable numeric(14,2) not null default 0,
  current_school_year_collection_amount numeric(14,2) not null default 0,
  remaining_receivable numeric(14,2) not null default 0,
  collection_rate numeric(8,4),
  growth_base_label text,
  analysis_level_2 text,
  analysis_level_1 text,
  permission_people text,
  source_file_name text not null,
  source_sheet_name text not null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (period_label, source_sheet_name, row_order)
);

create index if not exists idx_collection_receivables_period
  on public.edu_collection_receivables(period_label, row_order);

create index if not exists idx_collection_receivables_parent
  on public.edu_collection_receivables(parent_item_name);

create index if not exists idx_collection_receivables_business_category
  on public.edu_collection_receivables(business_category);

create index if not exists idx_collection_receivables_rate
  on public.edu_collection_receivables(collection_rate);

grant select on public.edu_collection_receivables to authenticated;
