use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuCliHealth {
    pub installed: bool,
    pub bundled: bool,
    pub configured: bool,
    pub authenticated: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub source: Option<String>,
    pub error: Option<String>,
    pub bundled_version: Option<String>,
    pub active_version: Option<String>,
    pub required_version: String,
    pub update_available: bool,
    pub update_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthDomainOption {
    pub id: String,
    pub label: String,
    pub description: String,
    pub enabled_scope_count: usize,
    pub available: bool,
    pub recommended: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthScopeCatalog {
    pub domains: Vec<FeishuAuthDomainOption>,
    pub app_scopes: Vec<String>,
    pub recommended_domains: Vec<String>,
    pub app_id: Option<String>,
    pub brand: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthPreferences {
    pub selected_domains: Vec<String>,
    pub last_synced_domains: Vec<String>,
    pub pending_sync_domains: Vec<String>,
    pub pending_device_code: Option<String>,
    pub pending_verification_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthEffectiveState {
    pub selected_domains: Vec<String>,
    pub synced_domains: Vec<String>,
    pub pending_sync_domains: Vec<String>,
    pub granted_domains: Vec<String>,
    pub needs_sync: bool,
    pub pending_auth_url: Option<String>,
    pub authenticated: bool,
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthPreferencesSaveRequest {
    pub selected_domains: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthSyncRequest {
    pub selected_domains: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthSyncResult {
    pub selected_domains: Vec<String>,
    pub last_synced_domains: Vec<String>,
    pub verification_url: Option<String>,
    pub pending_device_code: Option<String>,
    pub has_device_code: bool,
    pub reauth_required: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuConfigInitRequest {
    pub app_id: String,
    pub app_secret: String,
    #[serde(default = "default_feishu_brand")]
    pub brand: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuAuthBeginRequest {
    #[serde(default)]
    pub domains: Vec<String>,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub excludes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuAuthCompleteRequest {
    pub device_code: String,
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

fn default_feishu_brand() -> String {
    "feishu".to_string()
}
