alter table public.edu_biz_report enable row level security;
alter table public.edu_biz_monthly_plan enable row level security;
alter table public.edu_org_hierarchy enable row level security;
alter table public.edu_strategy_budget_plan enable row level security;

drop policy if exists edu_biz_report_select_authenticated on public.edu_biz_report;
create policy edu_biz_report_select_authenticated
  on public.edu_biz_report
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists edu_biz_monthly_plan_select_authenticated on public.edu_biz_monthly_plan;
create policy edu_biz_monthly_plan_select_authenticated
  on public.edu_biz_monthly_plan
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists edu_org_hierarchy_select_authenticated on public.edu_org_hierarchy;
create policy edu_org_hierarchy_select_authenticated
  on public.edu_org_hierarchy
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline

drop policy if exists edu_strategy_budget_plan_select_authenticated on public.edu_strategy_budget_plan;
create policy edu_strategy_budget_plan_select_authenticated
  on public.edu_strategy_budget_plan
  for select
  to authenticated
  using (true); -- RLS-ALLOW: authenticated read-only baseline
