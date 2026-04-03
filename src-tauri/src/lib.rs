use std::sync::Arc;
use parking_lot::RwLock;
use tauri::{AppHandle, Manager};

mod config;
mod session;
mod ws_server;

pub struct AppState {
    pub sessions: Arc<RwLock<session::SessionManager>>,
    pub config: Arc<RwLock<config::IslandConfig>>,
}

// ═══ Tauri Commands ═══

/// Resize window to fit island + re-center at top
#[tauri::command]
fn resize_island(window: tauri::WebviewWindow, w: f64, h: f64) {
    // Use LogicalSize — Tauri handles DPI scaling automatically
    let _ = window.set_size(tauri::LogicalSize::new(w, h));
    // Re-center horizontally at top of screen
    if let Ok(Some(monitor)) = window.current_monitor() {
        let scale = window.scale_factor().unwrap_or(1.0);
        let mw = monitor.size().width as f64 / scale;
        let x = ((mw - w) / 2.0) as i32;
        let _ = window.set_position(tauri::LogicalPosition::new(x, 8));
    }
}

#[tauri::command]
fn recenter_window(window: tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let scale = window.scale_factor().unwrap_or(1.0);
        let mw = monitor.size().width as f64 / scale;
        if let Ok(ws) = window.inner_size() {
            let ww = ws.width as f64 / scale;
            let x = ((mw - ww) / 2.0) as i32;
            let _ = window.set_position(tauri::LogicalPosition::new(x, 8));
        }
    }
}

#[tauri::command]
fn dismiss_island(window: tauri::WebviewWindow) {
    let _ = window.set_position(tauri::PhysicalPosition::new(-9999, -9999));
}

#[tauri::command]
fn show_island(window: tauri::WebviewWindow) {
    recenter_window(window.clone());
    let _ = window.show();
}

#[tauri::command]
async fn get_config(state: tauri::State<'_, AppState>) -> Result<config::IslandConfig, String> {
    Ok(state.config.read().clone())
}

#[tauri::command]
async fn save_config(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    config: config::IslandConfig,
) -> Result<(), String> {
    *state.config.write() = config.clone();
    config::save_config(&app, &config).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_sessions(state: tauri::State<'_, AppState>) -> Result<Vec<session::SessionInfo>, String> {
    Ok(state.sessions.read().list())
}

// ═══ System Tray ═══

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::TrayIconBuilder;

    let show = MenuItemBuilder::with_id("show", "Show Island").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Claude Island")
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

// ═══ App Entry ═══

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        sessions: Arc::new(RwLock::new(session::SessionManager::new())),
        config: Arc::new(RwLock::new(config::IslandConfig::default())),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            // Load config
            let cfg = config::load_config(app.handle());
            *app.state::<AppState>().config.write() = cfg;

            // Setup tray
            setup_tray(app)?;

            // Spawn WebSocket server
            let handle = app.handle().clone();
            let sessions = app.state::<AppState>().sessions.clone();
            tauri::async_runtime::spawn(async move {
                ws_server::start(handle, sessions).await;
            });

            // Start as circle (56x56), centered at top
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_size(tauri::LogicalSize::new(56.0, 56.0));
                if let Ok(Some(monitor)) = w.current_monitor() {
                    let scale = w.scale_factor().unwrap_or(1.0);
                    let mw = monitor.size().width as f64 / scale;
                    let x = ((mw - 56.0) / 2.0) as i32;
                    let _ = w.set_position(tauri::LogicalPosition::new(x, 8));
                }
                let _ = w.show();
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            resize_island,
            recenter_window,
            dismiss_island,
            show_island,
            get_config,
            save_config,
            get_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
