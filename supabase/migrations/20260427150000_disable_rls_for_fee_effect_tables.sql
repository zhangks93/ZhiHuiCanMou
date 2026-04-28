drop policy if exists fee_effect_import_batches_select_authenticated on public.fee_effect_import_batches;
drop policy if exists fee_effect_person_summary_select_authenticated on public.fee_effect_person_summary;
drop policy if exists fee_effect_person_travel_projects_select_authenticated on public.fee_effect_person_travel_projects;
drop policy if exists fee_effect_person_hospitality_projects_select_authenticated on public.fee_effect_person_hospitality_projects;
drop policy if exists fee_effect_project_summary_select_authenticated on public.fee_effect_project_summary;

alter table public.fee_effect_import_batches disable row level security; -- RLS-ALLOW: user requested public fee-effect tables
alter table public.fee_effect_person_summary disable row level security; -- RLS-ALLOW: user requested public fee-effect tables
alter table public.fee_effect_person_travel_projects disable row level security; -- RLS-ALLOW: user requested public fee-effect tables
alter table public.fee_effect_person_hospitality_projects disable row level security; -- RLS-ALLOW: user requested public fee-effect tables
alter table public.fee_effect_project_summary disable row level security; -- RLS-ALLOW: user requested public fee-effect tables
