use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
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
