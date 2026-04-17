mod schedule_store;
mod settings_store;

use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use schedule_store::{ScheduleItem, ScheduleItemDraft, ScheduleStore};
use settings_store::{SettingsStore, StoredLlmSettings, StoredSettingsSnapshot, ThresholdSettings};

// Track deep link attempts for retry logic
struct DeepLinkState {
    last_attempt: Option<SystemTime>,
    retry_count: u32,
}

impl DeepLinkState {
    fn new() -> Self {
        Self {
            last_attempt: None,
            retry_count: 0,
        }
    }

    fn should_retry(&self, max_retries: u32) -> bool {
        self.retry_count < max_retries
    }

    fn record_attempt(&mut self) {
        self.last_attempt = Some(SystemTime::now());
        self.retry_count += 1;
    }

    fn reset(&mut self) {
        self.last_attempt = None;
        self.retry_count = 0;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let deep_link_state = Arc::new(Mutex::new(DeepLinkState::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(move |app| {
            let schedule_store =
                ScheduleStore::initialize(&app.handle()).map_err(std::io::Error::other)?;
            app.manage(schedule_store);
            let settings_store =
                SettingsStore::initialize(&app.handle()).map_err(std::io::Error::other)?;
            app.manage(settings_store);

            // 检查应用启动时是否通过 deep link 打开
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                println!("[Canmou] App started with deep link: {:?}", urls);
                if let Some(url) = urls.first() {
                    let state = deep_link_state.clone();
                    handle_deep_link(app.handle(), url.as_str(), state);
                }
            }

            // 监听运行时的 deep link 事件
            let handle = app.handle().clone();
            let state = deep_link_state.clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                println!("[Canmou] Deep link event received: {:?}", urls);
                if let Some(url) = urls.first() {
                    let state_clone = state.clone();
                    handle_deep_link(&handle, url.as_str(), state_clone);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            schedule_list_by_range,
            schedule_create,
            schedule_update_meeting_notes,
            schedule_delete,
            settings_get_all,
            settings_save_llm_config,
            settings_clear_llm_config,
            settings_save_threshold_settings,
            settings_reset_threshold_settings,
            settings_get_enabled_modules,
            settings_save_enabled_modules,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn schedule_list_by_range(
    store: tauri::State<'_, ScheduleStore>,
    start_date: String,
    end_date: String,
) -> Result<Vec<ScheduleItem>, String> {
    store.list_by_range(&start_date, &end_date)
}

#[tauri::command]
fn schedule_create(
    store: tauri::State<'_, ScheduleStore>,
    draft: ScheduleItemDraft,
) -> Result<ScheduleItem, String> {
    store.create(draft)
}

#[tauri::command]
fn schedule_update_meeting_notes(
    store: tauri::State<'_, ScheduleStore>,
    item_id: String,
    meeting_notes: String,
) -> Result<(), String> {
    store.update_meeting_notes(&item_id, &meeting_notes)
}

#[tauri::command]
fn schedule_delete(
    store: tauri::State<'_, ScheduleStore>,
    item_id: String,
) -> Result<(), String> {
    store.delete(&item_id)
}

#[tauri::command]
fn settings_get_all(
    store: tauri::State<'_, SettingsStore>,
) -> Result<StoredSettingsSnapshot, String> {
    store.get_all()
}

#[tauri::command]
fn settings_save_llm_config(
    store: tauri::State<'_, SettingsStore>,
    settings: StoredLlmSettings,
) -> Result<(), String> {
    store.save_llm_settings(settings)
}

#[tauri::command]
fn settings_clear_llm_config(
    store: tauri::State<'_, SettingsStore>,
) -> Result<(), String> {
    store.clear_llm_settings()
}

#[tauri::command]
fn settings_save_threshold_settings(
    store: tauri::State<'_, SettingsStore>,
    settings: ThresholdSettings,
) -> Result<(), String> {
    store.save_threshold_settings(settings)
}

#[tauri::command]
fn settings_reset_threshold_settings(
    store: tauri::State<'_, SettingsStore>,
) -> Result<(), String> {
    store.reset_threshold_settings()
}

#[tauri::command]
fn settings_get_enabled_modules(
    store: tauri::State<'_, SettingsStore>,
) -> Result<Option<Vec<String>>, String> {
    store.get_enabled_modules()
}

#[tauri::command]
fn settings_save_enabled_modules(
    store: tauri::State<'_, SettingsStore>,
    module_ids: Vec<String>,
) -> Result<(), String> {
    store.save_enabled_modules(module_ids)
}

fn handle_deep_link(handle: &tauri::AppHandle, url: &str, state: Arc<Mutex<DeepLinkState>>) {
    // 处理认证回调
    if url.starts_with("canmou://auth-callback") {
        // Record attempt
        if let Ok(mut state_guard) = state.lock() {
            state_guard.record_attempt();
        }

        let params = extract_auth_params(url);

        // Validate params
        if params.is_empty() {
            eprintln!("[Canmou] ERROR: No auth parameters found in deep link");
            emit_deep_link_error(
                handle,
                "DEEP_LINK_FAILED",
                "No authentication parameters in deep link",
            );
            return;
        }

        // Check for required tokens
        if !has_required_auth_tokens(&params) {
            eprintln!("[Canmou] ERROR: Missing required tokens in deep link");
            emit_deep_link_error(
                handle,
                "MISSING_TOKENS",
                "Missing access_token or refresh_token",
            );
            return;
        }

        // 获取主窗口并导航到认证回调页面
        match handle.get_webview_window("main") {
            Some(window) => {
                let target_hash = format!("/auth-callback#{}", params);
                let serialized_hash = match serde_json::to_string(&target_hash) {
                    Ok(value) => value,
                    Err(error) => {
                        emit_deep_link_error(
                            handle,
                            "DEEP_LINK_FAILED",
                            &format!("Failed to encode navigation target: {}", error),
                        );
                        return;
                    }
                };
                let js_code = format!("window.location.hash = {}", serialized_hash);

                match window.eval(&js_code) {
                    Ok(_) => {
                        // Reset retry count on success
                        if let Ok(mut state_guard) = state.lock() {
                            state_guard.reset();
                        }
                        // Emit success event
                        if let Err(e) = handle.emit("deep-link:success", ()) {
                            eprintln!("[Canmou] Failed to emit success event: {}", e);
                        }
                    }
                    Err(e) => {
                        eprintln!("[Canmou] Navigation failed: {}", e);

                        // Check if we should retry
                        let should_retry = if let Ok(state_guard) = state.lock() {
                            state_guard.should_retry(3)
                        } else {
                            false
                        };

                        if should_retry {
                            let handle_clone = handle.clone();
                            let url_clone = url.to_string();
                            let state_clone = state.clone();

                            std::thread::spawn(move || {
                                std::thread::sleep(Duration::from_secs(2));
                                handle_deep_link(&handle_clone, &url_clone, state_clone);
                            });
                        } else {
                            emit_deep_link_error(
                                handle,
                                "DEEP_LINK_FAILED",
                                &format!("Navigation failed: {}", e),
                            );
                        }
                    }
                }
            }
            None => {
                eprintln!("[Canmou] ERROR: Main window not found");
                emit_deep_link_error(handle, "WINDOW_NOT_FOUND", "Main window not found");
            }
        }
    }
}

fn extract_auth_params(url: &str) -> String {
    if let Some(fragment) = url.split('#').nth(1) {
        return fragment.to_string();
    }

    if let Some(query) = url.split('?').nth(1) {
        return query.split('#').next().unwrap_or("").to_string();
    }

    String::new()
}

fn has_required_auth_tokens(params: &str) -> bool {
    let query_pairs = params
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .collect::<std::collections::HashMap<_, _>>();

    query_pairs.contains_key("access_token") && query_pairs.contains_key("refresh_token")
}

fn emit_deep_link_error(handle: &tauri::AppHandle, code: &str, message: &str) {
    #[derive(Clone, serde::Serialize)]
    struct ErrorPayload {
        code: String,
        message: String,
    }

    let payload = ErrorPayload {
        code: code.to_string(),
        message: message.to_string(),
    };

    if let Err(e) = handle.emit("deep-link:error", payload) {
        eprintln!("[Canmou] Failed to emit error event: {}", e);
    }
}
