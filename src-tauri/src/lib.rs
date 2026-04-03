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

#[tauri::command]
fn drag_window(window: tauri::WebviewWindow, dx: i32, dy: i32) {
    if let Ok(pos) = window.outer_position() {
        let _ = window.set_position(tauri::PhysicalPosition::new(pos.x + dx, pos.y + dy));
    }
}

#[tauri::command]
fn recenter_window(window: tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let x = (size.width as i32 - 500) / 2;
        let _ = window.set_position(tauri::PhysicalPosition::new(x, 8));
    }
}

#[tauri::command]
fn dismiss_island(window: tauri::WebviewWindow) {
    let _ = window.set_position(tauri::PhysicalPosition::new(-9999, -9999));
}

#[tauri::command]
fn show_island(window: tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let x = (size.width as i32 - 500) / 2;
        let _ = window.set_position(tauri::PhysicalPosition::new(x, 8));
    }
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

            // Show window centered
            if let Some(w) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = w.current_monitor() {
                    let size = monitor.size();
                    let x = (size.width as i32 - 500) / 2;
                    let _ = w.set_position(tauri::PhysicalPosition::new(x, 8));
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
            drag_window,
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
