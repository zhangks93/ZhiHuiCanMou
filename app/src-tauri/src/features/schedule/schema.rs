use crate::infra::error::AppResult;
use rusqlite::Connection;

pub fn ensure(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        r#"
        create table if not exists schedule_items (
          id text primary key,
          title text not null check(length(trim(title)) > 0),
          description text,
          date text not null check(length(date) = 10),
          period text not null check(period in ('morning', 'afternoon', 'evening')),
          start_time text,
          end_time text,
          type text check(type in ('meeting', 'business', 'routine', 'urgent') or type is null),
          location text,
          meeting_notes text,
          created_at text not null,
          check (
            (start_time is null and end_time is null)
            or (start_time is not null and end_time is not null)
          ),
          check (end_time is null or start_time is null or end_time > start_time)
        );

        create index if not exists idx_schedule_items_date_period_start
          on schedule_items(date, period, start_time, created_at);
        "#,
    )?;

    Ok(())
}
