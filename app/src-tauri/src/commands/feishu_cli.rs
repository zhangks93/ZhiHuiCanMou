use crate::features::feishu_cli::{
    FeishuAuthBeginRequest, FeishuAuthCompleteRequest, FeishuCliHealth, FeishuCliRequest,
    FeishuCliResponse, FeishuCliService, FeishuConfigInitRequest, FeishuWritePreview,
};

#[tauri::command]
pub async fn feishu_cli_health(
    service: tauri::State<'_, FeishuCliService>,
) -> Result<FeishuCliHealth, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.health())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn feishu_config_init(
    service: tauri::State<'_, FeishuCliService>,
    request: FeishuConfigInitRequest,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.config_init(request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_auth_begin(
    service: tauri::State<'_, FeishuCliService>,
    request: FeishuAuthBeginRequest,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.auth_begin(request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_auth_complete(
    service: tauri::State<'_, FeishuCliService>,
    request: FeishuAuthCompleteRequest,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.auth_complete(request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_config_remove(
    service: tauri::State<'_, FeishuCliService>,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.config_remove())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_auth_status(
    service: tauri::State<'_, FeishuCliService>,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.auth_status())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_read_operation(
    service: tauri::State<'_, FeishuCliService>,
    request: FeishuCliRequest,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.read_operation(request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_write_preview(
    service: tauri::State<'_, FeishuCliService>,
    request: FeishuCliRequest,
) -> Result<FeishuWritePreview, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.write_preview(request))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn feishu_write_confirm(
    service: tauri::State<'_, FeishuCliService>,
    operation_id: String,
) -> Result<FeishuCliResponse, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.write_confirm(operation_id))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}
