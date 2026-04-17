use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProviderSettings {
    pub api_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredLlmSettings {
    pub provider: String,
    pub providers: HashMap<String, StoredProviderSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThresholdConfig {
    pub yellow_threshold: f64,
    pub red_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdSettings {
    pub default: ThresholdConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSettingsSnapshot {
    pub llm: Option<StoredLlmSettings>,
    pub thresholds: Option<ThresholdSettings>,
    pub enabled_modules: Option<Vec<String>>,
}
