use crate::commands;
use crate::features::agent_chat::AgentChatService;
use crate::features::assistant_memory::AssistantMemoryService;
use crate::features::feishu_cli::FeishuCliService;
use crate::features::schedule::ScheduleService;
use crate::features::settings::SettingsService;
use crate::infra::error::AppResult;
use crate::infra::sqlite::AppDatabase;
use crate::runtime::deep_link;
use tauri::Manager;

fn initialize_services(app: &tauri::AppHandle) -> AppResult<()> {
    let database = AppDatabase::initialize(app)?;
    let memory_vault_path = database.memory_vault_path()?;

    app.manage(AgentChatService::new(database.clone()));
    app.manage(AssistantMemoryService::new(
        database.clone(),
        memory_vault_path,
    ));
    app.manage(FeishuCliService::new(database.clone()));
    app.manage(ScheduleService::new(database.clone()));
    app.manage(SettingsService::new(database));

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            initialize_services(&app.handle()).map_err(|error| -> Box<dyn std::error::Error> {
                Box::new(std::io::Error::other(error.to_string()))
            })?;
            deep_link::install(app).map_err(|error| -> Box<dyn std::error::Error> {
                Box::new(std::io::Error::other(error.to_string()))
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::agent_chat::agent_chat_list_conversations,
            commands::agent_chat::agent_chat_save_conversations,
            commands::agent_chat::agent_chat_upsert_conversation,
            commands::agent_chat::agent_chat_prune_conversations,
            commands::agent_chat::agent_chat_delete_conversation,
            commands::agent_chat::agent_chat_get_artifact_payload,
            commands::assistant_memory::assistant_memory_store,
            commands::assistant_memory::assistant_memory_recall,
            commands::assistant_memory::assistant_memory_get,
            commands::assistant_memory::assistant_memory_get_source,
            commands::assistant_memory::assistant_memory_forget,
            commands::assistant_memory::assistant_memory_list_namespaces,
            commands::assistant_memory::assistant_memory_health,
            commands::feishu_cli::feishu_cli_health,
            commands::feishu_cli::feishu_auth_status,
            commands::feishu_cli::feishu_read_operation,
            commands::feishu_cli::feishu_write_preview,
            commands::feishu_cli::feishu_write_confirm,
            commands::schedule::schedule_list_by_range,
            commands::schedule::schedule_create,
            commands::schedule::schedule_update_meeting_notes,
            commands::schedule::schedule_delete,
            commands::schedule::schedule_import_feishu_calendar,
            commands::schedule::schedule_export_transfer_payload,
            commands::schedule::schedule_import_transfer_payload,
            commands::settings::settings_get_all,
            commands::settings::settings_save_llm_config,
            commands::settings::settings_clear_llm_config,
            commands::settings::settings_save_threshold_settings,
            commands::settings::settings_reset_threshold_settings,
            commands::settings::settings_get_enabled_modules,
            commands::settings::settings_save_enabled_modules,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
