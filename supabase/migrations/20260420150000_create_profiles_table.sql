create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  feishu_open_id text unique,
  name text,
  avatar_url text,
  org_id uuid,
  org_node_id uuid,
  reports_to_id uuid references public.profiles (id) on delete set null,
  role text check (role in ('president', 'director', 'manager', 'supervisor')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_name
  on public.profiles (name);

create index if not exists idx_profiles_org_id
  on public.profiles (org_id);

create index if not exists idx_profiles_org_node_id
  on public.profiles (org_node_id);

create index if not exists idx_profiles_reports_to_id
  on public.profiles (reports_to_id);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
