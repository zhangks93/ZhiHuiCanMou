use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
