use crate::features::settings::model::{
    StoredLlmSettings, StoredProviderSettings, StoredSettingsSnapshot, ThresholdSettings,
};
use crate::features::settings::repository::{
    SettingsRepository, KEY_LLM_ACTIVE_PROVIDER, KEY_LLM_PROVIDERS, KEY_MODULES_ENABLED,
    KEY_THRESHOLDS_DEFAULT,
};
use crate::features::settings::schema;
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;
use std::collections::HashMap;

#[derive(Clone)]
pub struct SettingsService {
    database: AppDatabase,
}

impl SettingsService {
    pub fn new(database: AppDatabase) -> Self {
        Self { database }
    }

    pub fn get_all(&self) -> AppResult<StoredSettingsSnapshot> {
        Ok(StoredSettingsSnapshot {
            llm: self.get_llm_settings()?,
            thresholds: self.get_threshold_settings()?,
            enabled_modules: self.get_enabled_modules()?,
        })
    }

    pub fn get_llm_settings(&self) -> AppResult<Option<StoredLlmSettings>> {
        let connection = self.database.open_connection()?;

        let Some(provider) = SettingsRepository::get_value(&connection, KEY_LLM_ACTIVE_PROVIDER)?
        else {
            return Ok(None);
        };

        let Some(providers_raw) = SettingsRepository::get_value(&connection, KEY_LLM_PROVIDERS)?
        else {
            return Ok(None);
        };

        let providers =
            serde_json::from_str::<HashMap<String, StoredProviderSettings>>(&providers_raw)?;

        Ok(Some(StoredLlmSettings {
            provider,
            providers,
        }))
    }

    pub fn save_llm_settings(&self, settings: StoredLlmSettings) -> AppResult<()> {
        let provider = settings.provider.trim().to_string();
        if provider.is_empty() {
            return Err(AppError::message("LLM provider is required"));
        }

        let active = settings.providers.get(&provider).ok_or_else(|| {
            AppError::message(format!("Active provider settings missing: {provider}"))
        })?;

        if active.api_url.trim().is_empty() {
            return Err(AppError::message("LLM apiUrl is required"));
        }
        if active.model.trim().is_empty() {
            return Err(AppError::message("LLM model is required"));
        }
        if active.api_key.trim().is_empty() {
            return Err(AppError::message("LLM apiKey is required"));
        }

        let serialized = serde_json::to_string(&settings.providers)?;
        let connection = self.database.open_connection()?;
        SettingsRepository::set_value(&connection, KEY_LLM_ACTIVE_PROVIDER, &provider)?;
        SettingsRepository::set_value(&connection, KEY_LLM_PROVIDERS, &serialized)?;
        Ok(())
    }

    pub fn clear_llm_settings(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        SettingsRepository::delete_keys(&connection, &[KEY_LLM_ACTIVE_PROVIDER, KEY_LLM_PROVIDERS])
    }

    pub fn get_threshold_settings(&self) -> AppResult<Option<ThresholdSettings>> {
        let connection = self.database.open_connection()?;
        let Some(raw) = SettingsRepository::get_value(&connection, KEY_THRESHOLDS_DEFAULT)? else {
            return Ok(None);
        };

        let settings = serde_json::from_str::<ThresholdSettings>(&raw)?;
        Ok(Some(settings))
    }

    pub fn save_threshold_settings(&self, settings: ThresholdSettings) -> AppResult<()> {
        if settings.default.yellow_threshold <= settings.default.red_threshold {
            return Err(AppError::message(
                "Threshold yellowThreshold must be greater than redThreshold",
            ));
        }

        let serialized = serde_json::to_string(&settings)?;
        let connection = self.database.open_connection()?;
        SettingsRepository::set_value(&connection, KEY_THRESHOLDS_DEFAULT, &serialized)
    }

    pub fn reset_threshold_settings(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        SettingsRepository::delete_keys(&connection, &[KEY_THRESHOLDS_DEFAULT])
    }

    pub fn get_enabled_modules(&self) -> AppResult<Option<Vec<String>>> {
        let connection = self.database.open_connection()?;
        let Some(raw) = SettingsRepository::get_value(&connection, KEY_MODULES_ENABLED)? else {
            return Ok(None);
        };

        let values = serde_json::from_str::<Vec<String>>(&raw)?;
        Ok(Some(values))
    }

    pub fn save_enabled_modules(&self, module_ids: Vec<String>) -> AppResult<()> {
        let serialized = serde_json::to_string(&module_ids)?;
        let connection = self.database.open_connection()?;
        SettingsRepository::set_value(&connection, KEY_MODULES_ENABLED, &serialized)
    }

    pub fn ensure_schema(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        schema::ensure(&connection)
    }
}
