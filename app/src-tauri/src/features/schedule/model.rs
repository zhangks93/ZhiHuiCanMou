use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub period: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub location: Option<String>,
    pub meeting_notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleItemDraft {
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub period: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleImportResult {
    pub inserted_count: usize,
    pub overwritten_count: usize,
    pub skipped_count: usize,
    pub imported_dates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleTransferSender {
    pub user_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleTransferItem {
    pub source_item_id: String,
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub period: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub location: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleTransferPayload {
    pub transfer_version: u32,
    pub module: String,
    pub exported_at: String,
    pub sender: ScheduleTransferSender,
    pub items: Vec<ScheduleTransferItem>,
}
