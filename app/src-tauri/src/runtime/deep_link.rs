use crate::infra::error::AppResult;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use url::Url;

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

pub fn install(app: &mut tauri::App) -> AppResult<()> {
    let state = Arc::new(Mutex::new(DeepLinkState::new()));

    if let Some(url) = current_deep_link(app)? {
        handle_auth_callback(app.handle(), &url, state.clone());
    }

    let handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        if let Some(url) = event.urls().first() {
            handle_auth_callback(&handle, url.as_str(), state.clone());
        }
    });

    Ok(())
}

fn current_deep_link(app: &tauri::App) -> AppResult<Option<String>> {
    let Some(urls) = app.deep_link().get_current()? else {
        return Ok(None);
    };

    Ok(urls.first().map(|url| url.to_string()))
}

fn handle_auth_callback(handle: &tauri::AppHandle, url: &str, state: Arc<Mutex<DeepLinkState>>) {
    if !is_supported_auth_callback(url) {
        return;
    }

    if let Ok(mut guard) = state.lock() {
        guard.record_attempt();
    }

    let params = extract_auth_params(url);
    if params.is_empty() {
        emit_error(
            handle,
            "DEEP_LINK_FAILED",
            "No authentication parameters in deep link",
        );
        return;
    }

    let Ok(sanitized_params) = sanitize_auth_params(&params) else {
        emit_error(
            handle,
            "DEEP_LINK_FAILED",
            "Deep link contains unsupported or duplicated authentication parameters",
        );
        return;
    };

    if sanitized_params.is_empty() {
        emit_error(
            handle,
            "DEEP_LINK_FAILED",
            "No supported authentication parameters in deep link",
        );
        return;
    }

    if !has_required_auth_tokens(&sanitized_params) {
        emit_error(
            handle,
            "MISSING_TOKENS",
            "Missing access_token or refresh_token",
        );
        return;
    }

    let Some(window) = handle.get_webview_window("main") else {
        emit_error(handle, "WINDOW_NOT_FOUND", "Main window not found");
        return;
    };

    let target_hash = format!("/auth-callback#{sanitized_params}");
    let serialized_hash = match serde_json::to_string(&target_hash) {
        Ok(value) => value,
        Err(error) => {
            emit_error(
                handle,
                "DEEP_LINK_FAILED",
                &format!("Failed to encode navigation target: {error}"),
            );
            return;
        }
    };

    let js_code = format!("window.location.hash = {serialized_hash}");
    match window.eval(&js_code) {
        Ok(_) => {
            if let Ok(mut guard) = state.lock() {
                guard.reset();
            }
            emit_success(handle);
        }
        Err(error) => {
            let should_retry = state
                .lock()
                .map(|guard| guard.should_retry(3))
                .unwrap_or(false);

            if should_retry {
                let handle_clone = handle.clone();
                let url_clone = url.to_string();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(2));
                    handle_auth_callback(&handle_clone, &url_clone, state);
                });
            } else {
                emit_error(
                    handle,
                    "DEEP_LINK_FAILED",
                    &format!("Navigation failed: {error}"),
                );
            }
        }
    }
}

fn extract_auth_params(url: &str) -> String {
    if let Ok(parsed_url) = Url::parse(url) {
        if let Some(fragment) = parsed_url.fragment() {
            return fragment.to_string();
        }

        if let Some(query) = parsed_url.query() {
            return query.to_string();
        }
    }

    String::new()
}

fn is_supported_auth_callback(url: &str) -> bool {
    let Ok(parsed_url) = Url::parse(url) else {
        return false;
    };

    parsed_url.scheme() == "canmou"
        && parsed_url.host_str() == Some("auth-callback")
        && parsed_url.username().is_empty()
        && parsed_url.password().is_none()
        && parsed_url.port().is_none()
        && parsed_url.path().trim_matches('/').is_empty()
}

fn has_required_auth_tokens(params: &str) -> bool {
    let query_pairs = params
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .collect::<HashMap<_, _>>();

    matches!(query_pairs.get("access_token"), Some(value) if !value.is_empty())
        && matches!(query_pairs.get("refresh_token"), Some(value) if !value.is_empty())
}

fn sanitize_auth_params(params: &str) -> Result<String, ()> {
    const ALLOWED_KEYS: &[&str] = &[
        "access_token",
        "refresh_token",
        "expires_at",
        "expires_in",
        "provider_token",
        "provider_refresh_token",
        "token_type",
        "type",
    ];

    let mut seen_keys = HashMap::new();
    let mut sanitized = Vec::new();

    for (key, value) in params.split('&').filter_map(|pair| pair.split_once('=')) {
        if !ALLOWED_KEYS.contains(&key) {
            return Err(());
        }
        if value.is_empty() {
            continue;
        }
        if seen_keys.insert(key, true).is_some() {
            return Err(());
        }
        sanitized.push(format!("{key}={value}"));
    }

    Ok(sanitized.join("&"))
}

fn emit_success(handle: &tauri::AppHandle) {
    if let Err(error) = handle.emit("deep-link:success", ()) {
        eprintln!("[Canmou] Failed to emit success event: {error}");
    }
}

fn emit_error(handle: &tauri::AppHandle, code: &str, message: &str) {
    #[derive(Clone, serde::Serialize)]
    struct ErrorPayload {
        code: String,
        message: String,
    }

    let payload = ErrorPayload {
        code: code.to_string(),
        message: message.to_string(),
    };

    if let Err(error) = handle.emit("deep-link:error", payload) {
        eprintln!("[Canmou] Failed to emit error event: {error}");
    }
}
