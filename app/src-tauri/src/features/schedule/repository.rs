use crate::features::schedule::model::ScheduleItem;
use crate::infra::error::{AppError, AppResult};
use rusqlite::{params, Connection};

pub struct ScheduleRepository;

impl ScheduleRepository {
    pub fn list_by_range(
        connection: &Connection,
        start_date: &str,
        end_date: &str,
    ) -> AppResult<Vec<ScheduleItem>> {
        let mut statement = connection.prepare(
            r#"
            select
              id,
              title,
              description,
              date,
              period,
              start_time,
              end_time,
              type,
              location,
              meeting_notes,
              created_at
            from schedule_items
            where date >= ?1 and date <= ?2
            order by
              date asc,
              case period
                when 'morning' then 0
                when 'afternoon' then 1
                when 'evening' then 2
                else 3
              end asc,
              start_time asc nulls last,
              created_at asc
            "#,
        )?;

        let rows = statement.query_map(params![start_date, end_date], |row| {
            Ok(ScheduleItem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                date: row.get(3)?,
                period: row.get(4)?,
                start_time: row.get(5)?,
                end_time: row.get(6)?,
                item_type: row.get(7)?,
                location: row.get(8)?,
                meeting_notes: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn insert(connection: &Connection, item: &ScheduleItem) -> AppResult<()> {
        connection.execute(
            r#"
            insert into schedule_items (
              id,
              title,
              description,
              date,
              period,
              start_time,
              end_time,
              type,
              location,
              meeting_notes,
              created_at
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                &item.id,
                &item.title,
                &item.description,
                &item.date,
                &item.period,
                &item.start_time,
                &item.end_time,
                &item.item_type,
                &item.location,
                &item.meeting_notes,
                &item.created_at,
            ],
        )?;

        Ok(())
    }

    pub fn find_by_time_slot(
        connection: &Connection,
        date: &str,
        start_time: &str,
        end_time: &str,
    ) -> AppResult<Option<ScheduleItem>> {
        let mut statement = connection.prepare(
            r#"
            select
              id,
              title,
              description,
              date,
              period,
              start_time,
              end_time,
              type,
              location,
              meeting_notes,
              created_at
            from schedule_items
            where date = ?1 and start_time = ?2 and end_time = ?3
            limit 1
            "#,
        )?;

        let mut rows = statement.query(params![date, start_time, end_time])?;
        let Some(row) = rows.next()? else {
            return Ok(None);
        };

        Ok(Some(ScheduleItem {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            date: row.get(3)?,
            period: row.get(4)?,
            start_time: row.get(5)?,
            end_time: row.get(6)?,
            item_type: row.get(7)?,
            location: row.get(8)?,
            meeting_notes: row.get(9)?,
            created_at: row.get(10)?,
        }))
    }

    pub fn update_core_fields(connection: &Connection, item: &ScheduleItem) -> AppResult<()> {
        connection.execute(
            r#"
            update schedule_items
            set
              title = ?2,
              description = ?3,
              date = ?4,
              period = ?5,
              start_time = ?6,
              end_time = ?7,
              type = ?8,
              location = ?9
            where id = ?1
            "#,
            params![
                &item.id,
                &item.title,
                &item.description,
                &item.date,
                &item.period,
                &item.start_time,
                &item.end_time,
                &item.item_type,
                &item.location,
            ],
        )?;

        Ok(())
    }

    pub fn update_meeting_notes(
        connection: &Connection,
        item_id: &str,
        meeting_notes: Option<String>,
    ) -> AppResult<bool> {
        let affected = connection.execute(
            "update schedule_items set meeting_notes = ?1 where id = ?2",
            params![meeting_notes, item_id],
        )?;

        Ok(affected > 0)
    }

    pub fn delete(connection: &Connection, item_id: &str) -> AppResult<bool> {
        let affected =
            connection.execute("delete from schedule_items where id = ?1", params![item_id])?;
        Ok(affected > 0)
    }
}
