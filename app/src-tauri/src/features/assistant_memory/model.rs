use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryCategory {
    Core,
    Daily,
    Conversation,
    Custom,
}

impl MemoryCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Core => "core",
            Self::Daily => "daily",
            Self::Conversation => "conversation",
            Self::Custom => "custom",
        }
    }
}

impl From<String> for MemoryCategory {
    fn from(value: String) -> Self {
        match value.as_str() {
            "core" => Self::Core,
            "daily" => Self::Daily,
            "conversation" => Self::Conversation,
            _ => Self::Custom,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMemoryInput {
    pub namespace: String,
    pub category: MemoryCategory,
    pub title: String,
    pub content: String,
    pub importance: Option<i64>,
    pub source_agent_id: Option<String>,
    pub source_conversation_id: Option<String>,
    pub source_message_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMemoryEntry {
    pub id: String,
    pub namespace: String,
    pub category: MemoryCategory,
    pub title: String,
    pub content: String,
    pub importance: i64,
    pub source_agent_id: Option<String>,
    pub source_conversation_id: Option<String>,
    pub source_message_id: Option<String>,
    pub content_sha: String,
    pub file_path: String,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMemorySource {
    pub memory_id: String,
    pub content: String,
    pub file_path: String,
    pub content_sha: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMemoryRecallQuery {
    pub query: String,
    pub namespaces: Option<Vec<String>>,
    pub categories: Option<Vec<MemoryCategory>>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMemoryRecallResult {
    pub entry: AssistantMemoryEntry,
    pub score: f64,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMemoryHealth {
    pub memory_count: i64,
    pub source_count: i64,
    pub vault_path: String,
}
