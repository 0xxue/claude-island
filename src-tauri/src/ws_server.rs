use std::sync::Arc;
use parking_lot::RwLock;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};

use crate::session::SessionManager;
use crate::session::ws_server_types::BridgeMessage;

const PORT: u16 = 19432;

pub async fn start(app: AppHandle, sessions: Arc<RwLock<SessionManager>>) {
    let listener = match TcpListener::bind(format!("127.0.0.1:{}", PORT)).await {
        Ok(l) => l,
        Err(e) => {
            log::error!("[Island] Failed to bind WS server on port {}: {}", PORT, e);
            return;
        }
    };

    log::info!("[Island] WS server on ws://127.0.0.1:{}", PORT);

    while let Ok((stream, _addr)) = listener.accept().await {
        let app = app.clone();
        let sessions = sessions.clone();

        tokio::spawn(async move {
            let ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(_) => return,
            };

            let (_write, mut read) = ws_stream.split();

            while let Some(Ok(msg)) = read.next().await {
                if let Ok(text) = msg.to_text() {
                    let event: BridgeMessage = match serde_json::from_str(text) {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    // Update session manager
                    sessions.write().handle_event(&event);

                    // Show window on events (except start/end)
                    match event.event_type.as_str() {
                        "start" | "end" => {
                            // Don't show island for session lifecycle events
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
