use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const KEY_LLM_ACTIVE_PROVIDER: &str = "llm.active_provider";
const KEY_LLM_PROVIDERS: &str = "llm.providers";
const KEY_THRESHOLDS_DEFAULT: &str = "thresholds.default";
const KEY_MODULES_ENABLED: &str = "modules.enabled";

#[derive(Clone)]
pub struct SettingsStore {
    db_path: PathBuf,
}

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

impl SettingsStore {
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
                create table if not exists app_settings (
                  key text primary key,
                  value text not null,
                  updated_at text not null
                );
                "#,
            )
            .map_err(|error| format!("Failed to initialize settings schema: {error}"))?;

        Ok(())
    }

    fn get_value(&self, key: &str) -> Result<Option<String>, String> {
        let connection = self.open_connection()?;
        connection
            .query_row(
                "select value from app_settings where key = ?1",
                params![key],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("Failed to read setting {key}: {error}"))
    }

    fn set_value(&self, key: &str, value: &str) -> Result<(), String> {
        let connection = self.open_connection()?;
        connection
            .execute(
                r#"
                insert into app_settings (key, value, updated_at)
                values (?1, ?2, ?3)
                on conflict(key) do update set
                  value = excluded.value,
                  updated_at = excluded.updated_at
                "#,
                params![key, value, Utc::now().to_rfc3339()],
            )
            .map_err(|error| format!("Failed to write setting {key}: {error}"))?;
        Ok(())
    }

    fn delete_keys(&self, keys: &[&str]) -> Result<(), String> {
        let connection = self.open_connection()?;
        let mut statement = connection
            .prepare("delete from app_settings where key = ?1")
            .map_err(|error| format!("Failed to prepare settings delete statement: {error}"))?;

        for key in keys {
            statement
                .execute(params![key])
                .map_err(|error| format!("Failed to delete setting {key}: {error}"))?;
        }

        Ok(())
    }

    pub fn get_all(&self) -> Result<StoredSettingsSnapshot, String> {
        Ok(StoredSettingsSnapshot {
            llm: self.get_llm_settings()?,
            thresholds: self.get_threshold_settings()?,
            enabled_modules: self.get_enabled_modules()?,
        })
    }

    pub fn get_llm_settings(&self) -> Result<Option<StoredLlmSettings>, String> {
        let Some(provider) = self.get_value(KEY_LLM_ACTIVE_PROVIDER)? else {
            return Ok(None);
        };

        let Some(providers_raw) = self.get_value(KEY_LLM_PROVIDERS)? else {
            return Ok(None);
        };

        let providers = serde_json::from_str::<HashMap<String, StoredProviderSettings>>(&providers_raw)
            .map_err(|error| format!("Failed to decode LLM providers from settings: {error}"))?;

        Ok(Some(StoredLlmSettings { provider, providers }))
    }

    pub fn save_llm_settings(&self, settings: StoredLlmSettings) -> Result<(), String> {
        let provider = settings.provider.trim().to_string();
        if provider.is_empty() {
            return Err("LLM provider is required".to_string());
        }

        let active = settings
            .providers
            .get(&provider)
            .ok_or_else(|| format!("Active provider settings missing: {provider}"))?;

        if active.api_url.trim().is_empty() {
            return Err("LLM apiUrl is required".to_string());
        }
        if active.model.trim().is_empty() {
            return Err("LLM model is required".to_string());
        }
        if active.api_key.trim().is_empty() {
            return Err("LLM apiKey is required".to_string());
        }

        let serialized = serde_json::to_string(&settings.providers)
            .map_err(|error| format!("Failed to encode LLM providers for settings: {error}"))?;

        self.set_value(KEY_LLM_ACTIVE_PROVIDER, &provider)?;
        self.set_value(KEY_LLM_PROVIDERS, &serialized)?;
        Ok(())
    }

    pub fn clear_llm_settings(&self) -> Result<(), String> {
        self.delete_keys(&[KEY_LLM_ACTIVE_PROVIDER, KEY_LLM_PROVIDERS])
    }

    pub fn get_threshold_settings(&self) -> Result<Option<ThresholdSettings>, String> {
        let Some(raw) = self.get_value(KEY_THRESHOLDS_DEFAULT)? else {
            return Ok(None);
        };

        let settings = serde_json::from_str::<ThresholdSettings>(&raw)
            .map_err(|error| format!("Failed to decode threshold settings: {error}"))?;
        Ok(Some(settings))
    }

    pub fn save_threshold_settings(&self, settings: ThresholdSettings) -> Result<(), String> {
        if settings.default.yellow_threshold <= settings.default.red_threshold {
            return Err("Threshold yellowThreshold must be greater than redThreshold".to_string());
        }

        let serialized = serde_json::to_string(&settings)
            .map_err(|error| format!("Failed to encode threshold settings: {error}"))?;
        self.set_value(KEY_THRESHOLDS_DEFAULT, &serialized)
    }

    pub fn reset_threshold_settings(&self) -> Result<(), String> {
        self.delete_keys(&[KEY_THRESHOLDS_DEFAULT])
    }

    pub fn get_enabled_modules(&self) -> Result<Option<Vec<String>>, String> {
        let Some(raw) = self.get_value(KEY_MODULES_ENABLED)? else {
            return Ok(None);
        };

        let values = serde_json::from_str::<Vec<String>>(&raw)
            .map_err(|error| format!("Failed to decode enabled modules: {error}"))?;
        Ok(Some(values))
    }

    pub fn save_enabled_modules(&self, module_ids: Vec<String>) -> Result<(), String> {
        let serialized = serde_json::to_string(&module_ids)
            .map_err(|error| format!("Failed to encode enabled modules: {error}"))?;
        self.set_value(KEY_MODULES_ENABLED, &serialized)
    }
}
