use crate::features::schedule::{
    ScheduleImportResult, ScheduleItem, ScheduleItemDraft, ScheduleService,
};

#[tauri::command]
pub async fn schedule_list_by_range(
    service: tauri::State<'_, ScheduleService>,
    start_date: String,
    end_date: String,
) -> Result<Vec<ScheduleItem>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.list_by_range(&start_date, &end_date))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn schedule_create(
    service: tauri::State<'_, ScheduleService>,
    draft: ScheduleItemDraft,
) -> Result<ScheduleItem, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.create(draft))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn schedule_update_meeting_notes(
    service: tauri::State<'_, ScheduleService>,
    item_id: String,
    meeting_notes: String,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.update_meeting_notes(&item_id, &meeting_notes)
    })
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn schedule_delete(
    service: tauri::State<'_, ScheduleService>,
    item_id: String,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.delete(&item_id))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn schedule_import_feishu_calendar(
    service: tauri::State<'_, ScheduleService>,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<ScheduleImportResult, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.import_feishu_calendar(&file_name, bytes))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}
