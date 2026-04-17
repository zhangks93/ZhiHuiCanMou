use crate::features::settings::{
    SettingsService, StoredLlmSettings, StoredSettingsSnapshot, ThresholdSettings,
};

#[tauri::command]
pub async fn settings_get_all(
    service: tauri::State<'_, SettingsService>,
) -> Result<StoredSettingsSnapshot, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.get_all())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn settings_save_llm_config(
    service: tauri::State<'_, SettingsService>,
    settings: StoredLlmSettings,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save_llm_settings(settings))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn settings_clear_llm_config(
    service: tauri::State<'_, SettingsService>,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.clear_llm_settings())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn settings_save_threshold_settings(
    service: tauri::State<'_, SettingsService>,
    settings: ThresholdSettings,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save_threshold_settings(settings))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn settings_reset_threshold_settings(
    service: tauri::State<'_, SettingsService>,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.reset_threshold_settings())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn settings_get_enabled_modules(
    service: tauri::State<'_, SettingsService>,
) -> Result<Option<Vec<String>>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.get_enabled_modules())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn settings_save_enabled_modules(
    service: tauri::State<'_, SettingsService>,
    module_ids: Vec<String>,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save_enabled_modules(module_ids))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}
