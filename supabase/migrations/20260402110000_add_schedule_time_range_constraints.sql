update public.schedule_items
set period = case
  when (start_time at time zone 'Asia/Shanghai')::time < time '12:00' then 'morning'
  when (start_time at time zone 'Asia/Shanghai')::time < time '18:00' then 'afternoon'
  else 'evening'
end
where start_time is not null
  and (
    period is null
    or period <> case
      when (start_time at time zone 'Asia/Shanghai')::time < time '12:00' then 'morning'
      when (start_time at time zone 'Asia/Shanghai')::time < time '18:00' then 'afternoon'
      else 'evening'
    end
  );

alter table public.schedule_items
  drop constraint if exists schedule_items_time_range_pair_check;

alter table public.schedule_items
  add constraint schedule_items_time_range_pair_check
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null)
  );

alter table public.schedule_items
  drop constraint if exists schedule_items_time_range_order_check;

alter table public.schedule_items
  add constraint schedule_items_time_range_order_check
  check (
    start_time is null
    or end_time is null
    or end_time > start_time
  );
