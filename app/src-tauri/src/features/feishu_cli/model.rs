use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuCliHealth {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub source: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuCliRequest {
    pub operation: String,
    #[serde(default)]
    pub args: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuCliResponse {
    pub operation: String,
    pub command: Vec<String>,
    pub stdout: String,
    pub stderr: String,
    pub parsed_json: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuWritePreview {
    pub operation_id: String,
    pub operation: String,
    pub summary: String,
    pub command: Vec<String>,
    pub dry_run_command: Vec<String>,
    pub dry_run_result: FeishuCliResponse,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuCliOperationLog {
    pub id: String,
    pub operation: String,
    pub args_json: String,
    pub dry_run_json: Option<String>,
    pub command_json: Option<String>,
    pub status: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub created_at: String,
    pub executed_at: Option<String>,
}
