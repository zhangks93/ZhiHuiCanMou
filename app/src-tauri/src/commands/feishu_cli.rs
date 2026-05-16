use crate::features::feishu_cli::{
    FeishuCliHealth, FeishuCliRequest, FeishuCliResponse, FeishuCliService, FeishuWritePreview,
};

#[tauri::command]
pub async fn feishu_cli_health(
    service: tauri::State<'_, FeishuCliService>,
    cli_path: Option<String>,
) -> Result<FeishuCliHealth, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.health(cli_path))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn feishu_auth_status(
    service: tauri::State<'_, FeishuCliService>,
    cli_path: Option<String>,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.auth_status(cli_path))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_read_operation(
    service: tauri::State<'_, FeishuCliService>,
    cli_path: Option<String>,
    request: FeishuCliRequest,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.read_operation(cli_path, request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_write_preview(
    service: tauri::State<'_, FeishuCliService>,
    cli_path: Option<String>,
    request: FeishuCliRequest,
) -> Result<FeishuWritePreview, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.write_preview(cli_path, request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_write_confirm(
    service: tauri::State<'_, FeishuCliService>,
    cli_path: Option<String>,
    operation_id: String,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.write_confirm(cli_path, operation_id))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}
