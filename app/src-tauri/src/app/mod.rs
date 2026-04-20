use crate::commands;
use crate::features::agent_chat::AgentChatService;
use crate::features::schedule::ScheduleService;
use crate::features::settings::SettingsService;
use crate::infra::error::AppResult;
use crate::infra::sqlite::AppDatabase;
use crate::runtime::deep_link;
use tauri::Manager;

fn initialize_services(app: &tauri::AppHandle) -> AppResult<()> {
    let database = AppDatabase::initialize(app)?;

    app.manage(AgentChatService::new(database.clone()));
    app.manage(ScheduleService::new(database.clone()));
    app.manage(SettingsService::new(database));

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            commands::schedule::schedule_list_by_range,
            commands::schedule::schedule_create,
            commands::schedule::schedule_update_meeting_notes,
            commands::schedule::schedule_delete,
            commands::schedule::schedule_import_feishu_calendar,
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
