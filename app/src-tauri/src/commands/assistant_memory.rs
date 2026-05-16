use crate::features::assistant_memory::{
    AssistantMemoryEntry, AssistantMemoryHealth, AssistantMemoryInput, AssistantMemoryRecallQuery,
    AssistantMemoryRecallResult, AssistantMemoryService, AssistantMemorySource,
};

#[tauri::command]
pub async fn assistant_memory_store(
    service: tauri::State<'_, AssistantMemoryService>,
    input: AssistantMemoryInput,
) -> Result<AssistantMemoryEntry, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.store(input))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn assistant_memory_recall(
    service: tauri::State<'_, AssistantMemoryService>,
    query: AssistantMemoryRecallQuery,
) -> Result<Vec<AssistantMemoryRecallResult>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.recall(query))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn assistant_memory_get(
    service: tauri::State<'_, AssistantMemoryService>,
    memory_id: String,
) -> Result<Option<AssistantMemoryEntry>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.get(&memory_id))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn assistant_memory_get_source(
    service: tauri::State<'_, AssistantMemoryService>,
    memory_id: String,
) -> Result<Option<AssistantMemorySource>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.get_source(&memory_id))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn assistant_memory_forget(
    service: tauri::State<'_, AssistantMemoryService>,
    memory_id: String,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.forget(&memory_id))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn assistant_memory_list_namespaces(
    service: tauri::State<'_, AssistantMemoryService>,
) -> Result<Vec<String>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.list_namespaces())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn assistant_memory_health(
    service: tauri::State<'_, AssistantMemoryService>,
) -> Result<AssistantMemoryHealth, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.health())
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}
