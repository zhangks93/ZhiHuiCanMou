alter table public.opportunity_ledger
  add column if not exists schema_version text not null default 'legacy',
  add column if not exists project_group text,
  add column if not exists stage_code text,
  add column if not exists stage_label text,
  add column if not exists progress_note text,
  add column if not exists target_date date,
  add column if not exists first_year_revenue numeric,
  add column if not exists legacy_item_type text,
  add column if not exists legacy_estimated_amount numeric,
  add column if not exists legacy_logistics_approved boolean,
  add column if not exists legacy_group_approved boolean,
  add column if not exists legacy_bid_date date,
  add column if not exists legacy_win_probability numeric,
  add column if not exists legacy_manager_ready boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'opportunity_ledger_schema_version_check'
      and conrelid = 'public.opportunity_ledger'::regclass
  ) then
    alter table public.opportunity_ledger
      add constraint opportunity_ledger_schema_version_check
      check (schema_version = any (array['legacy'::text, 'funnel_v2'::text]));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'opportunity_ledger_stage_code_check'
      and conrelid = 'public.opportunity_ledger'::regclass
  ) then
    alter table public.opportunity_ledger
      add constraint opportunity_ledger_stage_code_check
      check (
        stage_code is null
        or stage_code = any (
          array[
            'lead'::text,
            'opportunity'::text,
            'internal_approval'::text,
            'customer_approval'::text,
            'contracted'::text,
            'legacy'::text
          ]
        )
      );
  end if;
end
$$;
