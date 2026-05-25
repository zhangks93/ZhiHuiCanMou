alter table public.attendance_monthly_records_v2
  add column if not exists paid_leave_amount numeric not null default 0,
  add column if not exists unpaid_leave_amount numeric not null default 0;

comment on column public.attendance_monthly_records_v2.approved_leave_amount is
  'Backward-compatible compliant leave amount. Same value as paid_leave_amount after the refined attendance policy.';

comment on column public.attendance_monthly_records_v2.paid_leave_amount is
  'Paid or compliant leave amount counted toward attendance rate, including full-pay leave, compliant maternity/remote-office leave, and paid/full-pay school holiday leave.';

comment on column public.attendance_monthly_records_v2.unpaid_leave_amount is
  'Leave amount not counted toward attendance rate, including personal leave, sick leave, long sick leave, excess leave, and unpaid school holiday rest.';

with recalculated as (
  select
    id,
    case
      when work_unit = 'day' then
        coalesce(nullif(trim(raw_metrics ->> '产假天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '全薪假天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '居家办公天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '线上办公天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '全薪寒暑假天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '带薪寒暑假天数'), '')::numeric, 0)
      else
        coalesce(nullif(trim(raw_metrics ->> '产假时数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '全薪假时数'), '')::numeric, 0)
    end as paid_leave_amount,
    case
      when work_unit = 'day' then
        coalesce(nullif(trim(raw_metrics ->> '事假天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '病假天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '长病假天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '超休天数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '寒暑假天数'), '')::numeric, 0)
      else
        coalesce(nullif(trim(raw_metrics ->> '事假时数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '病假时数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '长病假时数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '超休时数'), '')::numeric, 0) +
        coalesce(nullif(trim(raw_metrics ->> '寒暑假休息时数'), '')::numeric, 0)
    end as unpaid_leave_amount,
    case
      when work_unit = 'day' then coalesce(nullif(trim(raw_metrics ->> '未满勤天数'), '')::numeric, 0)
      else coalesce(nullif(trim(raw_metrics ->> '未满勤时数'), '')::numeric, 0)
    end as unqualified_amount,
    case
      when work_unit = 'day' then coalesce(nullif(trim(raw_metrics ->> '在职法定节假日天数'), '')::numeric, 0)
      else coalesce(nullif(trim(raw_metrics ->> '在职法定节假日时数'), '')::numeric, 0)
    end as legal_holiday_amount
  from public.attendance_monthly_records_v2
),
qualified as (
  select
    r.id,
    r.paid_leave_amount,
    r.unpaid_leave_amount,
    least(
      a.expected_work_amount,
      a.actual_work_amount + r.paid_leave_amount + r.unqualified_amount + r.legal_holiday_amount
    ) as qualified_attendance_amount
  from recalculated r
  join public.attendance_monthly_records_v2 a on a.id = r.id
)
update public.attendance_monthly_records_v2 a
set
  paid_leave_amount = q.paid_leave_amount,
  unpaid_leave_amount = q.unpaid_leave_amount,
  approved_leave_amount = q.paid_leave_amount,
  qualified_attendance_amount = q.qualified_attendance_amount,
  attendance_rate = case
    when a.expected_work_amount > 0 then q.qualified_attendance_amount / a.expected_work_amount
    else 0
  end,
  updated_at = now()
from qualified q
where a.id = q.id;
