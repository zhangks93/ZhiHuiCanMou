use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct ScheduleStore {
    db_path: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct ScheduleItem {
    id: String,
    title: String,
    description: Option<String>,
    date: String,
    period: String,
    start_time: Option<String>,
    end_time: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    location: Option<String>,
    meeting_notes: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleItemDraft {
    title: String,
    description: Option<String>,
    date: String,
    period: String,
    start_time: Option<String>,
    end_time: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    location: Option<String>,
}

impl ScheduleStore {
    pub fn initialize(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;

        fs::create_dir_all(&app_data_dir)
            .map_err(|error| format!("Failed to create app data dir: {error}"))?;

        let db_path = app_data_dir.join("canmou.db");
        let store = Self { db_path };
        store.ensure_schema()?;
        Ok(store)
    }

    fn open_connection(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path)
            .map_err(|error| format!("Failed to open SQLite database {}: {error}", self.db_path.display()))
    }

    fn ensure_schema(&self) -> Result<(), String> {
        let connection = self.open_connection()?;
        connection
            .execute_batch(
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
            )
            .map_err(|error| format!("Failed to initialize schedule schema: {error}"))?;

        Ok(())
    }

    pub fn list_by_range(&self, start_date: &str, end_date: &str) -> Result<Vec<ScheduleItem>, String> {
        let connection = self.open_connection()?;
        let mut statement = connection
            .prepare(
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
            )
            .map_err(|error| format!("Failed to prepare schedule list query: {error}"))?;

        let rows = statement
            .query_map(params![start_date, end_date], |row| {
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
            })
            .map_err(|error| format!("Failed to query schedules: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode schedules: {error}"))
    }

    pub fn create(&self, draft: ScheduleItemDraft) -> Result<ScheduleItem, String> {
        let title = draft.title.trim().to_string();
        if title.is_empty() {
            return Err("Schedule title is required".to_string());
        }

        let created_item = ScheduleItem {
            id: generate_schedule_id(),
            title,
            description: draft.description.and_then(normalize_optional_text),
            date: draft.date,
            period: draft.period,
            start_time: draft.start_time,
            end_time: draft.end_time,
            item_type: draft.item_type.and_then(normalize_optional_text),
            location: draft.location.and_then(normalize_optional_text),
            meeting_notes: None,
            created_at: Utc::now().to_rfc3339(),
        };

        validate_schedule_item_fields(
            &created_item.date,
            &created_item.period,
            created_item.item_type.as_deref(),
            created_item.start_time.as_deref(),
            created_item.end_time.as_deref(),
        )?;

        let connection = self.open_connection()?;
        connection
            .execute(
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
                    &created_item.id,
                    &created_item.title,
                    &created_item.description,
                    &created_item.date,
                    &created_item.period,
                    &created_item.start_time,
                    &created_item.end_time,
                    &created_item.item_type,
                    &created_item.location,
                    &created_item.meeting_notes,
                    &created_item.created_at,
                ],
            )
            .map_err(|error| format!("Failed to insert schedule item: {error}"))?;

        Ok(created_item)
    }

    pub fn update_meeting_notes(&self, item_id: &str, meeting_notes: &str) -> Result<(), String> {
        let connection = self.open_connection()?;
        let affected = connection
            .execute(
                "update schedule_items set meeting_notes = ?1 where id = ?2",
                params![normalize_optional_text(meeting_notes.to_string()), item_id],
            )
            .map_err(|error| format!("Failed to update meeting notes: {error}"))?;

        if affected == 0 {
            return Err(format!("Schedule item not found: {item_id}"));
        }

        Ok(())
    }

    pub fn delete(&self, item_id: &str) -> Result<(), String> {
        let connection = self.open_connection()?;
        let affected = connection
            .execute("delete from schedule_items where id = ?1", params![item_id])
            .map_err(|error| format!("Failed to delete schedule item: {error}"))?;

        if affected == 0 {
            return Err(format!("Schedule item not found: {item_id}"));
        }

        Ok(())
    }
}

fn normalize_optional_text(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn validate_schedule_item_fields(
    date: &str,
    period: &str,
    item_type: Option<&str>,
    start_time: Option<&str>,
    end_time: Option<&str>,
) -> Result<(), String> {
    if !is_valid_date(date) {
        return Err(format!("Invalid schedule date: {date}"));
    }

    if !matches!(period, "morning" | "afternoon" | "evening") {
        return Err(format!("Invalid schedule period: {period}"));
    }

    if let Some(value) = item_type {
        if !matches!(value, "meeting" | "business" | "routine" | "urgent") {
            return Err(format!("Invalid schedule type: {value}"));
        }
    }

    match (start_time, end_time) {
        (None, None) => Ok(()),
        (Some(start), Some(end)) => {
            if !is_valid_datetime(start) {
                return Err(format!("Invalid schedule start_time: {start}"));
            }
            if !is_valid_datetime(end) {
                return Err(format!("Invalid schedule end_time: {end}"));
            }
            if end <= start {
                return Err("Schedule end_time must be later than start_time".to_string());
            }
            Ok(())
        }
        _ => Err("Schedule start_time and end_time must both be present or both be empty".to_string()),
    }
}

fn is_valid_date(value: &str) -> bool {
    chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
}

fn is_valid_datetime(value: &str) -> bool {
    chrono::DateTime::parse_from_rfc3339(value).is_ok()
}

fn generate_schedule_id() -> String {
    let timestamp = Utc::now()
        .timestamp_nanos_opt()
        .unwrap_or_else(|| Utc::now().timestamp_micros() * 1_000);

    format!("schedule-{timestamp}")
}
