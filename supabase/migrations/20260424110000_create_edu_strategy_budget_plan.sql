create table if not exists edu_strategy_budget_plan (
  id uuid primary key default gen_random_uuid(),
  strategy_group text not null,
  strategy_group_cn text not null,
  line_role text not null,
  business_line text not null,
  line_label text not null,
  plan_year integer not null,
  metric_code text not null,
  metric_name_cn text not null,
  value numeric,
  unit text not null,
  value_type text not null,
  sort_order integer not null default 0,
  source_note text,
  created_at timestamptz default now()
);

alter table edu_strategy_budget_plan
  add column if not exists strategy_group text,
  add column if not exists strategy_group_cn text,
  add column if not exists line_role text,
  add column if not exists business_line text,
  add column if not exists line_label text,
  add column if not exists plan_year integer,
  add column if not exists metric_code text,
  add column if not exists metric_name_cn text,
  add column if not exists value numeric,
  add column if not exists unit text,
  add column if not exists value_type text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists source_note text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'edu_strategy_budget_plan_unique_row'
      and conrelid = 'edu_strategy_budget_plan'::regclass
  ) then
    alter table edu_strategy_budget_plan
      add constraint edu_strategy_budget_plan_unique_row
      unique (line_label, plan_year, metric_code);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'edu_strategy_budget_plan_line_role_check'
      and conrelid = 'edu_strategy_budget_plan'::regclass
  ) then
    alter table edu_strategy_budget_plan
      add constraint edu_strategy_budget_plan_line_role_check
      check (line_role in ('detail', 'subtotal', 'total', 'kpi'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'edu_strategy_budget_plan_value_type_check'
      and conrelid = 'edu_strategy_budget_plan'::regclass
  ) then
    alter table edu_strategy_budget_plan
      add constraint edu_strategy_budget_plan_value_type_check
      check (value_type in ('absolute', 'ratio'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'edu_strategy_budget_plan_unit_check'
      and conrelid = 'edu_strategy_budget_plan'::regclass
  ) then
    alter table edu_strategy_budget_plan
      add constraint edu_strategy_budget_plan_unit_check
      check (unit in ('amount', 'ratio'));
  end if;
end $$;

create index if not exists idx_edu_strategy_budget_plan_year
  on edu_strategy_budget_plan(plan_year);

create index if not exists idx_edu_strategy_budget_plan_business_line
  on edu_strategy_budget_plan(business_line);

create index if not exists idx_edu_strategy_budget_plan_group_metric
  on edu_strategy_budget_plan(strategy_group, metric_code);

comment on table edu_strategy_budget_plan is '5年战略预算规划长表，来源于 25学年经营数据.xlsx 的 sheet 5';
comment on column edu_strategy_budget_plan.strategy_group is '战略分组英文标识：base_business / growth_engine / overall_total / strategic_kpi';
comment on column edu_strategy_budget_plan.strategy_group_cn is '战略分组中文名：基本盘 / 增长极 / 合计 / 战略指标';
comment on column edu_strategy_budget_plan.line_role is '行角色：detail 明细, subtotal 小计, total 合计, kpi 比率类战略指标';
comment on column edu_strategy_budget_plan.business_line is '归一化后的业务条线名称，用于分析汇总';
comment on column edu_strategy_budget_plan.line_label is 'Excel 原始行标签，保留原貌用于审计追溯';
comment on column edu_strategy_budget_plan.plan_year is '自然年，当前范围 2025-2030';
comment on column edu_strategy_budget_plan.metric_code is '指标编码：revenue / profit / revenue_growth_rate / profit_margin / cost_ratio';
comment on column edu_strategy_budget_plan.value is '指标值；金额类与比率类均保存在此字段';
comment on column edu_strategy_budget_plan.unit is '指标单位：amount 金额类, ratio 比率类';
comment on column edu_strategy_budget_plan.value_type is '指标值类型：absolute 绝对值, ratio 比率';
comment on column edu_strategy_budget_plan.source_note is 'Excel 备注说明，当前整张规划表共用同一备注';
