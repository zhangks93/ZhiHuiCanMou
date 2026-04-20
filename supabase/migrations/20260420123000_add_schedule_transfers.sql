create table if not exists public.schedule_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'cancelled')),
  payload_json jsonb not null,
  payload_hash text not null,
  imported_summary jsonb,
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  cancelled_at timestamptz,
  constraint schedule_transfers_sender_recipient_check
    check (sender_user_id <> recipient_user_id)
);

create index if not exists idx_schedule_transfers_recipient_status_created
  on public.schedule_transfers (recipient_user_id, status, created_at desc);

create index if not exists idx_schedule_transfers_sender_status_created
  on public.schedule_transfers (sender_user_id, status, created_at desc);

alter table public.schedule_transfers enable row level security;

create or replace function public.enforce_schedule_transfer_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.sender_user_id then
    if new.sender_user_id <> old.sender_user_id
      or new.recipient_user_id <> old.recipient_user_id
      or new.payload_json <> old.payload_json
      or new.payload_hash <> old.payload_hash
      or new.imported_summary is distinct from old.imported_summary
      or new.imported_at is distinct from old.imported_at
    then
      raise exception 'sender update fields are restricted';
    end if;

    if not (old.status = 'pending' and new.status = 'cancelled') then
      raise exception 'sender can only cancel pending transfers';
    end if;
  elsif auth.uid() = old.recipient_user_id then
    if new.sender_user_id <> old.sender_user_id
      or new.recipient_user_id <> old.recipient_user_id
      or new.payload_json <> old.payload_json
      or new.payload_hash <> old.payload_hash
      or new.cancelled_at is distinct from old.cancelled_at
    then
      raise exception 'recipient update fields are restricted';
    end if;

    if not (old.status = 'pending' and new.status = 'imported') then
      raise exception 'recipient can only import pending transfers';
    end if;
  else
    raise exception 'not authorized to update transfer';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_schedule_transfer_update_guard on public.schedule_transfers;

create trigger trg_schedule_transfer_update_guard
before update on public.schedule_transfers
for each row
execute function public.enforce_schedule_transfer_update();

create policy "schedule_transfers_select_participants"
  on public.schedule_transfers
  for select
  using (auth.uid() = sender_user_id or auth.uid() = recipient_user_id);

create policy "schedule_transfers_insert_sender"
  on public.schedule_transfers
  for insert
  with check (auth.uid() = sender_user_id);

create policy "schedule_transfers_update_sender_or_recipient"
  on public.schedule_transfers
  for update
  using (auth.uid() = sender_user_id or auth.uid() = recipient_user_id)
  with check (
    (auth.uid() = sender_user_id and sender_user_id = auth.uid())
    or (auth.uid() = recipient_user_id and recipient_user_id = auth.uid())
  );
