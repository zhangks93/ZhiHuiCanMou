use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(mobile)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // 注册 deep link 处理器
                let handle = app.handle().clone();
                app.deep_link().register("canmou", move |request| {
                    let url = request.to_string();
                    println!("[Canmou] Deep link received: {}", url);

                    // 解析 URL 并导航到对应页面
                    if url.starts_with("canmou://auth-callback") {
                        println!("[Canmou] Processing auth callback");

                        // 获取 URL 的 fragment 或 query 部分
                        let url_suffix = url.split("canmou://auth-callback").nth(1).unwrap_or("");
                        println!("[Canmou] URL suffix: {}", url_suffix);

                        // 通知前端处理认证回调
                        if let Some(window) = handle.get_webview_window("main") {
                            // 构造完整的 hash URL
                            let js_code = if url_suffix.starts_with('#') {
                                format!("window.location.hash = '/auth-callback{}'", url_suffix)
                            } else if url_suffix.starts_with('?') {
                                // 将 query string 转换为 hash
                                format!("window.location.hash = '/auth-callback#{}'", &url_suffix[1..])
                            } else if !url_suffix.is_empty() {
                                format!("window.location.hash = '/auth-callback#{}'", url_suffix)
                            } else {
                                "window.location.hash = '/auth-callback'".to_string()
                            };

                            println!("[Canmou] Executing JS: {}", js_code);

                            if let Err(e) = window.eval(&js_code) {
                                eprintln!("[Canmou] Failed to navigate: {}", e);
                            }
                        } else {
                            eprintln!("[Canmou] Main window not found");
                        }
                    }
                })?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
