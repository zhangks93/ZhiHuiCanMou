use crate::features::schedule::model::{ScheduleItem, ScheduleItemDraft};
use crate::features::schedule::{repository::ScheduleRepository, schema};
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;
use chrono::Utc;

#[derive(Clone)]
pub struct ScheduleService {
    database: AppDatabase,
}

impl ScheduleService {
    pub fn new(database: AppDatabase) -> Self {
        Self { database }
    }

    pub fn list_by_range(&self, start_date: &str, end_date: &str) -> AppResult<Vec<ScheduleItem>> {
        let connection = self.database.open_connection()?;
        ScheduleRepository::list_by_range(&connection, start_date, end_date)
    }

    pub fn create(&self, draft: ScheduleItemDraft) -> AppResult<ScheduleItem> {
        let title = draft.title.trim().to_string();
        if title.is_empty() {
            return Err(AppError::message("Schedule title is required"));
        }

        let item = ScheduleItem {
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
            &item.date,
            &item.period,
            item.item_type.as_deref(),
            item.start_time.as_deref(),
            item.end_time.as_deref(),
        )?;

        let connection = self.database.open_connection()?;
        ScheduleRepository::insert(&connection, &item)?;
        Ok(item)
    }

    pub fn update_meeting_notes(&self, item_id: &str, meeting_notes: &str) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        let updated = ScheduleRepository::update_meeting_notes(
            &connection,
            item_id,
            normalize_optional_text(meeting_notes.to_string()),
        )?;

        if !updated {
            return Err(AppError::message(format!(
                "Schedule item not found: {item_id}"
            )));
        }

        Ok(())
    }

    pub fn delete(&self, item_id: &str) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        let deleted = ScheduleRepository::delete(&connection, item_id)?;

        if !deleted {
            return Err(AppError::message(format!(
                "Schedule item not found: {item_id}"
            )));
        }

        Ok(())
    }

    pub fn ensure_schema(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        schema::ensure(&connection)
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
) -> AppResult<()> {
    if !is_valid_date(date) {
        return Err(AppError::message(format!("Invalid schedule date: {date}")));
    }

    if !matches!(period, "morning" | "afternoon" | "evening") {
        return Err(AppError::message(format!(
            "Invalid schedule period: {period}"
        )));
    }

    if let Some(value) = item_type {
        if !matches!(value, "meeting" | "business" | "routine" | "urgent") {
            return Err(AppError::message(format!("Invalid schedule type: {value}")));
        }
    }

    match (start_time, end_time) {
        (None, None) => Ok(()),
        (Some(start), Some(end)) => {
            if !is_valid_datetime(start) {
                return Err(AppError::message(format!(
                    "Invalid schedule start_time: {start}"
                )));
            }
            if !is_valid_datetime(end) {
                return Err(AppError::message(format!(
                    "Invalid schedule end_time: {end}"
                )));
            }
            if end <= start {
                return Err(AppError::message(
                    "Schedule end_time must be later than start_time",
                ));
            }
            Ok(())
        }
        _ => Err(AppError::message(
            "Schedule start_time and end_time must both be present or both be empty",
        )),
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
