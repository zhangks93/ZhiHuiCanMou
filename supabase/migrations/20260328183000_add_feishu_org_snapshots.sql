create table if not exists public.feishu_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  snapshot_taken boolean not null default false,
  snapshot_at timestamptz,
  last_snapshot_at timestamptz,
  snapshot_reason text,
  root_department_ids jsonb not null default '[]'::jsonb,
  department_count integer not null default 0,
  member_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.feishu_department_snapshots (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.feishu_sync_runs(id) on delete cascade,
  snapshot_at timestamptz not null,
  department_id text not null,
  name text not null,
  parent_id text,
  order_value integer not null default 0,
  member_count integer not null default 0,
  leader_user_id text,
  status jsonb,
  created_at timestamptz not null default now(),
  unique (sync_run_id, department_id)
);

create table if not exists public.feishu_member_snapshots (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.feishu_sync_runs(id) on delete cascade,
  snapshot_at timestamptz not null,
  open_id text not null,
  user_id text,
  name text not null,
  employee_no text,
  email text,
  primary_department_id text,
  department_ids jsonb not null default '[]'::jsonb,
  job_title text,
  gender smallint,
  employee_type smallint,
  status jsonb,
  join_time bigint,
  created_at timestamptz not null default now(),
  unique (sync_run_id, open_id)
);

create index if not exists idx_feishu_sync_runs_snapshot_at
  on public.feishu_sync_runs (snapshot_taken, snapshot_at desc, created_at desc);

create index if not exists idx_feishu_department_snapshots_department_id
  on public.feishu_department_snapshots (department_id, snapshot_at desc);

create index if not exists idx_feishu_department_snapshots_sync_run_id
  on public.feishu_department_snapshots (sync_run_id);

create index if not exists idx_feishu_member_snapshots_primary_department_id
  on public.feishu_member_snapshots (primary_department_id, snapshot_at desc);

create index if not exists idx_feishu_member_snapshots_sync_run_id
  on public.feishu_member_snapshots (sync_run_id);

alter table public.feishu_sync_runs enable row level security;
alter table public.feishu_department_snapshots enable row level security;
alter table public.feishu_member_snapshots enable row level security;

drop policy if exists feishu_sync_runs_select on public.feishu_sync_runs;
create policy feishu_sync_runs_select
  on public.feishu_sync_runs
  for select
  to public
  using (true);

drop policy if exists feishu_sync_runs_insert on public.feishu_sync_runs;
create policy feishu_sync_runs_insert
  on public.feishu_sync_runs
  for insert
  to public
  with check (true);

drop policy if exists feishu_department_snapshots_select on public.feishu_department_snapshots;
create policy feishu_department_snapshots_select
  on public.feishu_department_snapshots
  for select
  to public
  using (true);

drop policy if exists feishu_department_snapshots_insert on public.feishu_department_snapshots;
create policy feishu_department_snapshots_insert
  on public.feishu_department_snapshots
  for insert
  to public
  with check (true);

drop policy if exists feishu_member_snapshots_select on public.feishu_member_snapshots;
create policy feishu_member_snapshots_select
  on public.feishu_member_snapshots
  for select
  to public
  using (true);

drop policy if exists feishu_member_snapshots_insert on public.feishu_member_snapshots;
create policy feishu_member_snapshots_insert
  on public.feishu_member_snapshots
  for insert
  to public
  with check (true);

create or replace view public.feishu_department_member_changes as
with ranked_runs as (
  select
    id,
    snapshot_at,
    row_number() over (order by snapshot_at desc nulls last, created_at desc, id desc) as rn
  from public.feishu_sync_runs
  where snapshot_taken = true
),
latest_run as (
  select id, snapshot_at
  from ranked_runs
  where rn = 1
),
previous_run as (
  select id, snapshot_at
  from ranked_runs
  where rn = 2
),
latest_snapshot as (
  select s.*
  from public.feishu_department_snapshots s
  join latest_run r on r.id = s.sync_run_id
),
previous_snapshot as (
  select s.*
  from public.feishu_department_snapshots s
  join previous_run r on r.id = s.sync_run_id
)
select
  coalesce(l.department_id, p.department_id) as department_id,
  coalesce(l.name, p.name) as department_name,
  coalesce(l.parent_id, p.parent_id) as parent_id,
  coalesce(l.order_value, p.order_value, 0) as order_value,
  coalesce(l.member_count, 0) as current_member_count,
  coalesce(p.member_count, 0) as previous_member_count,
  coalesce(l.member_count, 0) - coalesce(p.member_count, 0) as member_count_change,
  case
    when p.department_id is null then 'new'
    when l.department_id is null then 'removed'
    when coalesce(l.member_count, 0) = coalesce(p.member_count, 0) then 'unchanged'
    else 'changed'
  end as change_type,
  lr.snapshot_at as latest_snapshot_at,
  pr.snapshot_at as previous_snapshot_at
from latest_snapshot l
full join previous_snapshot p using (department_id)
left join latest_run lr on true
left join previous_run pr on true;

comment on table public.feishu_sync_runs is '飞书组织同步执行记录，包含是否生成历史快照';
comment on table public.feishu_department_snapshots is '飞书部门历史快照，每次满足时间阈值时保存一份部门人数和层级';
comment on table public.feishu_member_snapshots is '飞书成员历史快照，每次满足时间阈值时保存一份人员归属数据';
comment on view public.feishu_department_member_changes is '最近两次飞书组织快照之间的部门人数变化视图';
