use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // 检查应用启动时是否通过 deep link 打开
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                println!("[Canmou] App started with deep link: {:?}", urls);
                if let Some(url) = urls.first() {
                    handle_deep_link(app.handle(), url);
                }
            }

            // 监听运行时的 deep link 事件
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                println!("[Canmou] Deep link event received: {:?}", event.urls());
                if let Some(url) = event.urls().first() {
                    handle_deep_link(&handle, url);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn handle_deep_link(handle: &tauri::AppHandle, url: &str) {
    println!("[Canmou] Processing deep link: {}", url);

    // 处理认证回调
    if url.starts_with("canmou://auth-callback") {
        println!("[Canmou] Auth callback detected");

        // 解析 URL 参数（支持 # 和 ? 两种格式）
        let params = if let Some(fragment) = url.split('#').nth(1) {
            fragment.to_string()
        } else if let Some(query) = url.split('?').nth(1) {
            query.split('#').next().unwrap_or("").to_string()
        } else {
            String::new()
        };

        println!("[Canmou] Auth params: {}", params);

        // 获取主窗口并导航到认证回调页面
        if let Some(window) = handle.get_webview_window("main") {
            let js_code = if !params.is_empty() {
                format!("window.location.hash = '/auth-callback#{}'", params)
            } else {
                "window.location.hash = '/auth-callback'".to_string()
            };

            println!("[Canmou] Executing navigation: {}", js_code);

            if let Err(e) = window.eval(&js_code) {
                eprintln!("[Canmou] Navigation failed: {}", e);
            } else {
                println!("[Canmou] Navigation successful");
            }
        } else {
            eprintln!("[Canmou] Main window not found");
        }
    }
}
