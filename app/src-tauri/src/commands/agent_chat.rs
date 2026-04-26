use crate::features::agent_chat::{
    AgentChatService, StoredArtifactPayloadRecord, StoredConversation,
};

#[tauri::command]
pub async fn agent_chat_list_conversations(
    service: tauri::State<'_, AgentChatService>,
    agent_id: String,
) -> Result<Vec<StoredConversation>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.list_conversations(&agent_id))
        .await
        .map_err(|error| error.to_string())?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn agent_chat_save_conversations(
    service: tauri::State<'_, AgentChatService>,
    agent_id: String,
    conversations: Vec<StoredConversation>,
    payload_records: Vec<StoredArtifactPayloadRecord>,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.save_conversations(&agent_id, conversations, payload_records)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(Into::into)
}

#[tauri::command]
pub async fn agent_chat_upsert_conversation(
    service: tauri::State<'_, AgentChatService>,
    agent_id: String,
    conversation: StoredConversation,
    payload_records: Vec<StoredArtifactPayloadRecord>,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.upsert_conversation(&agent_id, conversation, payload_records)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(Into::into)
}

#[tauri::command]
pub async fn agent_chat_prune_conversations(
    service: tauri::State<'_, AgentChatService>,
    agent_id: String,
    keep_conversation_ids: Vec<String>,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.prune_conversations(&agent_id, keep_conversation_ids)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(Into::into)
}

#[tauri::command]
pub async fn agent_chat_delete_conversation(
    service: tauri::State<'_, AgentChatService>,
    agent_id: String,
    conversation_id: String,
) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.delete_conversation(&agent_id, &conversation_id)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(Into::into)
}

#[tauri::command]
pub async fn agent_chat_get_artifact_payload(
    service: tauri::State<'_, AgentChatService>,
    agent_id: String,
    artifact_id: String,
) -> Result<Option<StoredArtifactPayloadRecord>, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.get_artifact_payload(&agent_id, &artifact_id)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(Into::into)
}
