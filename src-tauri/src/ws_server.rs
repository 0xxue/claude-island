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
                            // Permission: emit to UI, hold connection, wait for response
                            let request_id = event.request_id.clone()
                                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

                            // Emit with request_id
                            let mut emit_event = event.clone();
                            emit_event.request_id = Some(request_id.clone());
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
                            let _ = app.emit("claude-event", &event);
                        }
                    }
                }
            }
        });
    }
}
