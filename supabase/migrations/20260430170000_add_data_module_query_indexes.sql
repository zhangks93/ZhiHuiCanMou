create index if not exists idx_edu_biz_report_period_report_sort
  on public.edu_biz_report(period_type, report_type, period, sort_order);

create index if not exists idx_edu_biz_report_period_report_sheet_sort
  on public.edu_biz_report(period_type, report_type, period, sheet_code, sort_order);

create index if not exists idx_business_trips_start_time
  on public.business_trips(start_time desc);
