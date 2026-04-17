use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredConversation {
    pub id: String,
    pub title: String,
    pub messages: Vec<Value>,
    pub memory: Option<Value>,
    pub context: Option<Value>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredArtifactPayloadRecord {
    pub id: String,
    pub artifact_id: String,
    pub conversation_id: String,
    pub payload: String,
    pub tool_name: String,
    pub created_at: i64,
}
