drop index if exists public.opportunity_ledger_v2_stage_code_idx;
drop index if exists public.opportunity_ledger_v2_import_batch_id_idx;

alter table public.opportunity_ledger_v2
  drop constraint if exists opportunity_ledger_v2_import_batch_id_sheet_name_row_number_key,
  drop constraint if exists opportunity_ledger_v2_schema_version_check,
  drop constraint if exists opportunity_ledger_v2_stage_code_check;

alter table public.opportunity_ledger_v2
  add column if not exists first_year_revenue_text text;

update public.opportunity_ledger_v2
set first_year_revenue_text = coalesce(
  nullif(first_year_revenue_raw, ''),
  case
    when first_year_revenue is null then null
    else trim(to_char(first_year_revenue, 'FM999999999999990D################'))
  end
)
where first_year_revenue_text is null;

alter table public.opportunity_ledger_v2
  drop column if exists import_batch_id,
  drop column if exists schema_version,
  drop column if exists stage_code,
  drop column if exists expected_finish_date_raw,
  drop column if exists first_year_revenue_raw,
  drop column if exists first_year_revenue,
  drop column if exists source_file_name,
  drop column if exists source_file_path,
  drop column if exists imported_at,
  drop column if exists created_at,
  drop column if exists updated_at;

alter table public.opportunity_ledger_v2
  rename column first_year_revenue_text to first_year_revenue;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'opportunity_ledger_v2_snapshot_sheet_row_key'
      and conrelid = 'public.opportunity_ledger_v2'::regclass
  ) then
    alter table public.opportunity_ledger_v2
      add constraint opportunity_ledger_v2_snapshot_sheet_row_key
        unique (snapshot_date, sheet_name, row_number);
  end if;
end $$;

create index if not exists opportunity_ledger_v2_stage_label_idx
  on public.opportunity_ledger_v2 (stage_label);

comment on table public.opportunity_ledger_v2 is 'Opportunity records parsed from the latest workbook, keeping Excel fields plus snapshot metadata';
comment on column public.opportunity_ledger_v2.snapshot_date is 'Snapshot date parsed from sheet name using academic-year rules';
comment on column public.opportunity_ledger_v2.first_year_revenue is 'Original first-year revenue text from Excel';
