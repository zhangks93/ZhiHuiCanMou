-- Redesign edu_org_hierarchy to align with the new mapping workbook headers:
-- level_0, level_1, level_2, node_name

create table if not exists edu_org_hierarchy (
  id uuid primary key default gen_random_uuid(),
  node_name text not null,
  level_0 text,
  level_1 text,
  level_2 text,
  created_at timestamptz default now()
);

alter table edu_org_hierarchy
  add column if not exists level_0 text,
  add column if not exists level_1 text,
  add column if not exists level_2 text,
  add column if not exists created_at timestamptz default now();

alter table edu_org_hierarchy
  drop column if exists level_3,
  drop column if exists label;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'edu_org_hierarchy_node_name_key'
      and conrelid = 'edu_org_hierarchy'::regclass
  ) then
    alter table edu_org_hierarchy
      add constraint edu_org_hierarchy_node_name_key unique (node_name);
  end if;
end $$;

create index if not exists idx_edu_org_hierarchy_level_0 on edu_org_hierarchy(level_0);
create index if not exists idx_edu_org_hierarchy_level_1 on edu_org_hierarchy(level_1);
create index if not exists idx_edu_org_hierarchy_level_2 on edu_org_hierarchy(level_2);

comment on table edu_org_hierarchy is '教育后勤组织层级映射表，来源于组织标签映射 Excel';
comment on column edu_org_hierarchy.level_0 is '集团层级';
comment on column edu_org_hierarchy.level_1 is '一级组织层级';
comment on column edu_org_hierarchy.level_2 is '二级组织层级';
comment on column edu_org_hierarchy.node_name is '最终业务节点名称，用于关联 edu_biz_report / edu_biz_monthly_plan';
