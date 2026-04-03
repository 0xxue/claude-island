use std::sync::Arc;
use parking_lot::RwLock;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{StreamExt, SinkExt};
use tauri::{AppHandle, Emitter};

use crate::session::SessionManager;
use crate::session::ws_server_types::BridgeMessage;
use crate::permission::PermissionRouter;

const PORT: u16 = 19432;

pub async fn start(
    app: AppHandle,
    sessions: Arc<RwLock<SessionManager>>,
    perm_router: Arc<PermissionRouter>,
) {
    let listener = match TcpListener::bind(format!("127.0.0.1:{}", PORT)).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[Island] Failed to bind WS server on port {}: {}", PORT, e);
            return;
        }
    };

    eprintln!("[Island] WS server on ws://127.0.0.1:{}", PORT);

    while let Ok((stream, _addr)) = listener.accept().await {
        let app = app.clone();
        let sessions = sessions.clone();
        let perm_router = perm_router.clone();

        tokio::spawn(async move {
            let ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(_) => return,
            };

            let (mut write, mut read) = ws_stream.split();

            while let Some(Ok(msg)) = read.next().await {
                if let Ok(text) = msg.to_text() {
                    let event: BridgeMessage = match serde_json::from_str(text) {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    // Update session manager
                    sessions.write().handle_event(&event);

                    match event.event_type.as_str() {
                        "start" | "end" => {
                            // Don't show island for session lifecycle events
                        }
                        "permission" => {
                            let request_id = event.request_id.clone()
                                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

                            let mut emit_event = event.clone();
                            emit_event.request_id = Some(request_id.clone());

                            // Inject foreground HWND
                            #[cfg(target_os = "windows")]
                            {
                                let fg = unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
                                if !fg.0.is_null() {
                                    if let Some(ref mut t) = emit_event.terminal {
                                        if t.hwnd.is_none() { t.hwnd = Some(fg.0 as u64); }
                                    }
                                }
                            }

                            let _ = app.emit("claude-event", &emit_event);

                            // Wait for UI response
                            match perm_router.wait_for_response(&request_id).await {
                                Some(response) => {
                                    let _ = write.send(
                                        tokio_tungstenite::tungstenite::Message::Text(response)
                                    ).await;
                                }
                                None => {
                                    // Timeout — send default allow
                                    let default = r#"{"decision":"allow","reason":"timeout"}"#;
                                    let _ = write.send(
                                        tokio_tungstenite::tungstenite::Message::Text(default.into())
                                    ).await;
                                }
                            }
                        }
                        _ => {
                            // Capture foreground window HWND — that's the terminal
                            #[cfg(target_os = "windows")]
                            {
                                let fg_hwnd = unsafe {
                                    windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow()
                                };
                                if !fg_hwnd.0.is_null() {
                                    let mut emit_event = event.clone();
                                    // Inject foreground HWND into terminal info
                                    if let Some(ref mut t) = emit_event.terminal {
                                        if t.hwnd.is_none() {
                                            t.hwnd = Some(fg_hwnd.0 as u64);
                                        }
                                    }
                                    let _ = app.emit("claude-event", &emit_event);
                                } else {
                                    let _ = app.emit("claude-event", &event);
                                }
                            }
                            #[cfg(not(target_os = "windows"))]
                            {
                                let _ = app.emit("claude-event", &event);
                            }
                        }
                    }
                }
            }
        });
    }
}
