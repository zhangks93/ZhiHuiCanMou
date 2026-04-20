use crate::features::schedule::model::{
    ScheduleImportResult, ScheduleItem, ScheduleItemDraft, ScheduleTransferItem,
    ScheduleTransferPayload, ScheduleTransferSender,
};
use crate::features::schedule::{repository::ScheduleRepository, schema};
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;
use calamine::{Data, Reader, Xlsx};
use chrono::{FixedOffset, NaiveDateTime, NaiveTime, TimeZone, Timelike, Utc};
use rusqlite::Transaction;
use std::collections::HashSet;
use std::io::Cursor;

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

    pub fn export_transfer_payload(
        &self,
        item_ids: &[String],
        sender_user_id: &str,
        sender_name: &str,
    ) -> AppResult<ScheduleTransferPayload> {
        if item_ids.is_empty() {
            return Err(AppError::message(
                "At least one schedule item is required to export a transfer payload",
            ));
        }

        let connection = self.database.open_connection()?;
        let items = ScheduleRepository::list_by_ids(&connection, item_ids)?;

        if items.len() != item_ids.len() {
            return Err(AppError::message(
                "Some schedule items could not be found for transfer export",
            ));
        }

        Ok(ScheduleTransferPayload {
            transfer_version: 1,
            module: "schedule".to_string(),
            exported_at: Utc::now().to_rfc3339(),
            sender: ScheduleTransferSender {
                user_id: sender_user_id.trim().to_string(),
                name: sender_name.trim().to_string(),
            },
            items: items.into_iter().map(map_transfer_item).collect(),
        })
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

    pub fn import_feishu_calendar(
        &self,
        file_name: &str,
        bytes: Vec<u8>,
    ) -> AppResult<ScheduleImportResult> {
        if !file_name.to_ascii_lowercase().ends_with(".xlsx") {
            return Err(AppError::message("Only .xlsx Feishu calendar exports are supported"));
        }

        let rows = parse_feishu_workbook(bytes)?;
        let mut connection = self.database.open_connection()?;
        let transaction = connection.transaction()?;
        let result = import_schedule_items(&transaction, rows.into_iter().map(|row| row.item))?;

        transaction.commit()?;
        Ok(result)
    }

    pub fn import_transfer_payload(
        &self,
        payload: ScheduleTransferPayload,
    ) -> AppResult<ScheduleImportResult> {
        validate_transfer_payload(&payload)?;

        let imported_items = payload
            .items
            .into_iter()
            .map(schedule_item_from_transfer)
            .collect::<AppResult<Vec<_>>>()?;

        let mut connection = self.database.open_connection()?;
        let transaction = connection.transaction()?;
        let result = import_schedule_items(&transaction, imported_items.into_iter())?;
        transaction.commit()?;
        Ok(result)
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

#[derive(Debug)]
struct FeishuScheduleImportRow {
    item: ScheduleItem,
}

fn map_transfer_item(item: ScheduleItem) -> ScheduleTransferItem {
    ScheduleTransferItem {
        source_item_id: item.id,
        title: item.title,
        description: item.description,
        date: item.date,
        period: item.period,
        start_time: item.start_time,
        end_time: item.end_time,
        item_type: item.item_type,
        location: item.location,
        created_at: item.created_at,
    }
}

fn validate_transfer_payload(payload: &ScheduleTransferPayload) -> AppResult<()> {
    if payload.transfer_version != 1 {
        return Err(AppError::message(format!(
            "Unsupported schedule transfer version: {}",
            payload.transfer_version
        )));
    }

    if payload.module != "schedule" {
        return Err(AppError::message(format!(
            "Unsupported transfer module: {}",
            payload.module
        )));
    }

    if payload.sender.user_id.trim().is_empty() || payload.sender.name.trim().is_empty() {
        return Err(AppError::message(
            "Schedule transfer sender information is required",
        ));
    }

    if payload.items.is_empty() {
        return Err(AppError::message(
            "Schedule transfer payload must include at least one item",
        ));
    }

    Ok(())
}

fn schedule_item_from_transfer(item: ScheduleTransferItem) -> AppResult<ScheduleItem> {
    let imported_item = ScheduleItem {
        id: generate_schedule_id(),
        title: item.title.trim().to_string(),
        description: item.description.and_then(normalize_optional_text),
        date: item.date,
        period: item.period,
        start_time: item.start_time,
        end_time: item.end_time,
        item_type: item.item_type.and_then(normalize_optional_text),
        location: item.location.and_then(normalize_optional_text),
        meeting_notes: None,
        created_at: item.created_at,
    };

    if imported_item.title.is_empty() {
        return Err(AppError::message(
            "Imported schedule transfer item title is required",
        ));
    }

    validate_schedule_item_fields(
        &imported_item.date,
        &imported_item.period,
        imported_item.item_type.as_deref(),
        imported_item.start_time.as_deref(),
        imported_item.end_time.as_deref(),
    )?;

    Ok(imported_item)
}

fn import_schedule_items<I>(
    transaction: &Transaction<'_>,
    items: I,
) -> AppResult<ScheduleImportResult>
where
    I: IntoIterator<Item = ScheduleItem>,
{
    let mut seen_keys = HashSet::new();
    let mut imported_dates = HashSet::new();
    let mut inserted_count = 0usize;
    let mut overwritten_count = 0usize;

    for item in items {
        let Some(start_time) = item.start_time.as_deref() else {
            return Err(AppError::message(format!(
                "Imported schedule row is missing start_time: {}",
                item.title
            )));
        };
        let Some(end_time) = item.end_time.as_deref() else {
            return Err(AppError::message(format!(
                "Imported schedule row is missing end_time: {}",
                item.title
            )));
        };

        let conflict_key = format!("{}|{}|{}", item.date, start_time, end_time);
        if !seen_keys.insert(conflict_key.clone()) {
            return Err(AppError::message(format!(
                "Duplicate schedules found in payload for time slot: {conflict_key}"
            )));
        }

        imported_dates.insert(item.date.clone());
        upsert_imported_item(transaction, item, &mut inserted_count, &mut overwritten_count)?;
    }

    let mut imported_dates = imported_dates.into_iter().collect::<Vec<_>>();
    imported_dates.sort();

    Ok(ScheduleImportResult {
        inserted_count,
        overwritten_count,
        skipped_count: 0,
        imported_dates,
    })
}

fn upsert_imported_item(
    transaction: &Transaction<'_>,
    imported_item: ScheduleItem,
    inserted_count: &mut usize,
    overwritten_count: &mut usize,
) -> AppResult<()> {
    let start_time = imported_item
        .start_time
        .as_deref()
        .ok_or_else(|| AppError::message("Imported schedule start_time is required"))?;
    let end_time = imported_item
        .end_time
        .as_deref()
        .ok_or_else(|| AppError::message("Imported schedule end_time is required"))?;

    if let Some(existing_item) = ScheduleRepository::find_by_time_slot(
        transaction,
        &imported_item.date,
        start_time,
        end_time,
    )? {
        let updated_item = ScheduleItem {
            id: existing_item.id,
            title: imported_item.title,
            description: imported_item.description,
            date: imported_item.date,
            period: imported_item.period,
            start_time: imported_item.start_time,
            end_time: imported_item.end_time,
            item_type: imported_item.item_type,
            location: imported_item.location,
            meeting_notes: existing_item.meeting_notes,
            created_at: existing_item.created_at,
        };

        ScheduleRepository::update_core_fields(transaction, &updated_item)?;
        *overwritten_count += 1;
        return Ok(());
    }

    ScheduleRepository::insert(transaction, &imported_item)?;
    *inserted_count += 1;
    Ok(())
}

fn parse_feishu_workbook(bytes: Vec<u8>) -> AppResult<Vec<FeishuScheduleImportRow>> {
    let cursor = Cursor::new(bytes);
    let mut workbook = Xlsx::new(cursor)
        .map_err(|error| AppError::message(format!("Failed to read workbook: {error}")))?;

    let range = workbook
        .worksheet_range("日历详情")
        .map_err(|error| AppError::message(format!("Failed to read sheet 日历详情: {error}")))?;

    let mut rows = range.rows();
    let header_row_index = rows
        .position(|row| cell_string(row.first()) == Some("日程主题".to_string()))
        .ok_or_else(|| AppError::message("Feishu calendar export header row was not found"))?;

    let all_rows = range.rows().collect::<Vec<_>>();
    let header = all_rows
        .get(header_row_index)
        .ok_or_else(|| AppError::message("Feishu calendar export header row is missing"))?;

    let title_index = header_index(header, "日程主题")?;
    let start_index = header_index(header, "日程开始时间")?;
    let end_index = header_index(header, "日程结束时间")?;
    let repeat_index = header_index(header, "是否重复性日程")?;
    let organizer_index = header_index(header, "组织者")?;
    let participant_index = header_index(header, "参与者")?;
    let room_index = header_index(header, "会议室")?;
    let location_index = header_index(header, "地点")?;
    let sign_required_index = header_index(header, "是否需要签到")?;
    let sign_time_index = header_index(header, "签到时间")?;
    let description_index = header_index(header, "描述")?;
    let attachment_index = header_index(header, "附件（仅显示文件名称）")?;

    let mut imported_rows = Vec::new();
    for row in all_rows.iter().skip(header_row_index + 1) {
        let title = normalize_feishu_text(cell_string(row.get(title_index)));
        let start_text = normalize_feishu_text(cell_string(row.get(start_index)));
        let end_text = normalize_feishu_text(cell_string(row.get(end_index)));

        if title.is_none() && start_text.is_none() && end_text.is_none() {
            continue;
        }

        let title = title.ok_or_else(|| AppError::message("Feishu schedule title is required"))?;
        let start_text = start_text
            .ok_or_else(|| AppError::message(format!("Schedule start time is required: {title}")))?;
        let end_text =
            end_text.ok_or_else(|| AppError::message(format!("Schedule end time is required: {title}")))?;

        let (date, start_time, period) = parse_feishu_datetime(&start_text)?;
        let (_, end_time, _) = parse_feishu_datetime(&end_text)?;

        validate_schedule_item_fields(
            &date,
            &period,
            Some("meeting"),
            Some(&start_time),
            Some(&end_time),
        )?;

        let room = normalize_feishu_text(cell_string(row.get(room_index)));
        let location = first_non_empty(vec![
            room.clone().filter(|value| value != "无"),
            normalize_feishu_text(cell_string(row.get(location_index))),
        ]);

        let description = build_import_description(
            normalize_feishu_text(cell_string(row.get(description_index))),
            normalize_feishu_text(cell_string(row.get(organizer_index))),
            normalize_feishu_text(cell_string(row.get(participant_index))),
            normalize_feishu_text(cell_string(row.get(repeat_index))),
            room,
            normalize_feishu_text(cell_string(row.get(sign_required_index))),
            normalize_feishu_text(cell_string(row.get(sign_time_index))),
            normalize_feishu_text(cell_string(row.get(attachment_index))),
        );

        imported_rows.push(FeishuScheduleImportRow {
            item: ScheduleItem {
                id: generate_schedule_id(),
                title,
                description,
                date,
                period,
                start_time: Some(start_time),
                end_time: Some(end_time),
                item_type: Some("meeting".to_string()),
                location,
                meeting_notes: None,
                created_at: Utc::now().to_rfc3339(),
            },
        });
    }

    if imported_rows.is_empty() {
        return Err(AppError::message("No schedule rows found in Feishu workbook"));
    }

    Ok(imported_rows)
}

fn header_index(header: &[Data], expected: &str) -> AppResult<usize> {
    header
        .iter()
        .position(|cell| cell_string(Some(cell)).as_deref() == Some(expected))
        .ok_or_else(|| AppError::message(format!("Missing Feishu column: {expected}")))
}

fn parse_feishu_datetime(value: &str) -> AppResult<(String, String, String)> {
    let datetime = NaiveDateTime::parse_from_str(value, "%Y/%m/%d %H:%M").map_err(|error| {
        AppError::message(format!("Invalid Feishu schedule datetime '{value}': {error}"))
    })?;

    let timezone = FixedOffset::east_opt(8 * 3600)
        .ok_or_else(|| AppError::message("Failed to initialize Asia/Shanghai timezone"))?;
    let local_datetime = timezone
        .from_local_datetime(&datetime)
        .single()
        .ok_or_else(|| AppError::message(format!("Ambiguous Feishu datetime: {value}")))?;

    let period = derive_period_from_time(datetime.time()).to_string();
    Ok((
        datetime.date().format("%Y-%m-%d").to_string(),
        local_datetime.to_rfc3339(),
        period,
    ))
}

fn derive_period_from_time(time: NaiveTime) -> &'static str {
    if time.hour() < 12 {
        "morning"
    } else if time.hour() < 18 {
        "afternoon"
    } else {
        "evening"
    }
}

fn build_import_description(
    description: Option<String>,
    organizer: Option<String>,
    participants: Option<String>,
    is_recurring: Option<String>,
    meeting_room: Option<String>,
    sign_required: Option<String>,
    sign_time: Option<String>,
    attachments: Option<String>,
) -> Option<String> {
    let mut parts = Vec::new();

    if let Some(description) = description {
        parts.push(description);
    }

    if let Some(value) = organizer {
        parts.push(format!("组织者：{value}"));
    }
    if let Some(value) = participants {
        parts.push(format!("参与者：{value}"));
    }
    if let Some(value) = is_recurring {
        parts.push(format!("是否重复性日程：{value}"));
    }
    if let Some(value) = meeting_room {
        parts.push(format!("会议室：{value}"));
    }
    if let Some(value) = sign_required {
        parts.push(format!("是否需要签到：{value}"));
    }
    if let Some(value) = sign_time {
        parts.push(format!("签到时间：{value}"));
    }
    if let Some(value) = attachments {
        parts.push(format!("附件：{value}"));
    }

    normalize_optional_text(parts.join("\n"))
}

fn cell_string(cell: Option<&Data>) -> Option<String> {
    match cell {
        Some(Data::String(value)) => Some(value.clone()),
        Some(Data::Float(value)) => Some(value.to_string()),
        Some(Data::Int(value)) => Some(value.to_string()),
        Some(Data::Bool(value)) => Some(value.to_string()),
        Some(Data::DateTime(value)) => Some(value.to_string()),
        Some(Data::DateTimeIso(value)) => Some(value.clone()),
        Some(Data::DurationIso(value)) => Some(value.clone()),
        Some(Data::Empty) | None => None,
        _ => None,
    }
}

fn normalize_feishu_text(value: Option<String>) -> Option<String> {
    let normalized = value.and_then(normalize_optional_text)?;
    if normalized == "无" {
        None
    } else {
        Some(normalized)
    }
}

fn first_non_empty(values: Vec<Option<String>>) -> Option<String> {
    values.into_iter().flatten().find(|value| !value.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn seed_schedule(
        connection: &Connection,
        id: &str,
        title: &str,
        meeting_notes: Option<&str>,
    ) -> AppResult<()> {
        ScheduleRepository::insert(
            connection,
            &ScheduleItem {
                id: id.to_string(),
                title: title.to_string(),
                description: Some("旧描述".to_string()),
                date: "2026-04-20".to_string(),
                period: "morning".to_string(),
                start_time: Some("2026-04-20T09:00:00+08:00".to_string()),
                end_time: Some("2026-04-20T10:00:00+08:00".to_string()),
                item_type: Some("meeting".to_string()),
                location: Some("旧地点".to_string()),
                meeting_notes: meeting_notes.map(|value| value.to_string()),
                created_at: "2026-04-20T08:00:00+08:00".to_string(),
            },
        )
    }

    #[test]
    fn import_transfer_items_overwrites_core_fields_but_keeps_notes() {
        let mut connection = Connection::open_in_memory().expect("open memory db");
        schema::ensure(&connection).expect("ensure schema");
        seed_schedule(&connection, "existing-1", "旧标题", Some("保留纪要")).expect("seed schedule");

        let transaction = connection.transaction().expect("begin transaction");
        let result = import_schedule_items(
            &transaction,
            vec![ScheduleItem {
                id: "incoming-1".to_string(),
                title: "新标题".to_string(),
                description: Some("新描述".to_string()),
                date: "2026-04-20".to_string(),
                period: "morning".to_string(),
                start_time: Some("2026-04-20T09:00:00+08:00".to_string()),
                end_time: Some("2026-04-20T10:00:00+08:00".to_string()),
                item_type: Some("business".to_string()),
                location: Some("新地点".to_string()),
                meeting_notes: None,
                created_at: "2026-04-20T09:30:00+08:00".to_string(),
            }]
            .into_iter(),
        )
        .expect("import items");
        transaction.commit().expect("commit transaction");

        assert_eq!(result.inserted_count, 0);
        assert_eq!(result.overwritten_count, 1);

        let items = ScheduleRepository::list_by_range(&connection, "2026-04-20", "2026-04-20")
            .expect("list items");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "新标题");
        assert_eq!(items[0].description.as_deref(), Some("新描述"));
        assert_eq!(items[0].location.as_deref(), Some("新地点"));
        assert_eq!(items[0].meeting_notes.as_deref(), Some("保留纪要"));
    }

    #[test]
    fn schedule_transfer_payload_requires_supported_module() {
        let error = validate_transfer_payload(&ScheduleTransferPayload {
            transfer_version: 1,
            module: "trip".to_string(),
            exported_at: "2026-04-20T09:30:00+08:00".to_string(),
            sender: ScheduleTransferSender {
                user_id: "user-1".to_string(),
                name: "发送人".to_string(),
            },
            items: vec![ScheduleTransferItem {
                source_item_id: "item-1".to_string(),
                title: "例会".to_string(),
                description: None,
                date: "2026-04-20".to_string(),
                period: "morning".to_string(),
                start_time: Some("2026-04-20T09:00:00+08:00".to_string()),
                end_time: Some("2026-04-20T10:00:00+08:00".to_string()),
                item_type: Some("meeting".to_string()),
                location: None,
                created_at: "2026-04-20T09:30:00+08:00".to_string(),
            }],
        })
        .expect_err("validate module mismatch");

        assert!(error.to_string().contains("Unsupported transfer module"));
    }
}
