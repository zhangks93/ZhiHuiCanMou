create table if not exists public.attendance_monthly_records_v2 (
  id uuid primary key default gen_random_uuid(),
  year_month integer not null,
  attendance_type text not null,
  employee_no text not null,
  employee_name text not null,
  member_id uuid null references public.feishu_members(id) on delete set null,
  work_unit text not null,
  department_path text[] not null default '{}',
  department_full_path text[] not null default '{}',
  expected_work_amount numeric not null default 0,
  normal_work_amount numeric not null default 0,
  actual_work_amount numeric not null default 0,
  approved_leave_amount numeric not null default 0,
  absence_amount numeric not null default 0,
  qualified_attendance_amount numeric not null default 0,
  attendance_rate numeric not null default 0,
  late_under_30_count integer not null default 0,
  late_30_to_120_count integer not null default 0,
  late_total_count integer not null default 0,
  missing_clock_count integer not null default 0,
  makeup_clock_count integer not null default 0,
  source_file_name text not null,
  source_sheet_name text not null,
  source_row_number integer not null,
  source_file_hash text not null,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_monthly_records_v2_type_check
    check (attendance_type in ('standard_day', 'comprehensive_hour')),
  constraint attendance_monthly_records_v2_work_unit_check
    check (work_unit in ('day', 'hour')),
  constraint attendance_monthly_records_v2_unique_employee_month_type
    unique (year_month, employee_no, attendance_type)
);

comment on table public.attendance_monthly_records_v2 is
  'Monthly attendance records imported from HR day/hour attendance workbooks. Department path is sourced from Excel and starts at 海亮智汇后勤集团 for display.';

create index if not exists idx_attendance_monthly_records_v2_year_month
  on public.attendance_monthly_records_v2 (year_month desc);

create index if not exists idx_attendance_monthly_records_v2_type
  on public.attendance_monthly_records_v2 (attendance_type);

create index if not exists idx_attendance_monthly_records_v2_employee_no
  on public.attendance_monthly_records_v2 (employee_no);

create index if not exists idx_attendance_monthly_records_v2_department_path
  on public.attendance_monthly_records_v2 using gin (department_path);

alter table public.attendance_monthly_records_v2 enable row level security;

drop policy if exists "Authenticated users can read attendance monthly records v2"
  on public.attendance_monthly_records_v2;

create policy "Authenticated users can read attendance monthly records v2"
  on public.attendance_monthly_records_v2
  for select
  to authenticated
  using (true);
