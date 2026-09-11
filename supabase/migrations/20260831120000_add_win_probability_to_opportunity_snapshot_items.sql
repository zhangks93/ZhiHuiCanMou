alter table public.opportunity_snapshot_items
  add column if not exists win_probability numeric;

create index if not exists opportunity_snapshot_items_snapshot_win_probability_project_idx
  on public.opportunity_snapshot_items (snapshot_date desc, win_probability desc nulls last, project_name);

comment on column public.opportunity_snapshot_items.win_probability is '商机落地概率，从 Excel 的商机落地概率列解析';
