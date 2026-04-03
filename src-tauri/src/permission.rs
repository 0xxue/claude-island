use std::collections::HashMap;
use parking_lot::Mutex;
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

const PERMISSION_TIMEOUT_SECS: u64 = 30;

pub struct PermissionRouter {
    pending: Mutex<HashMap<String, oneshot::Sender<String>>>,
}

impl PermissionRouter {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
        }
    }

    /// Called by WS server when a permission event arrives.
    /// Returns the response JSON string, or None on timeout.
    pub async fn wait_for_response(&self, request_id: &str) -> Option<String> {
        let (tx, rx) = oneshot::channel();
        self.pending.lock().insert(request_id.to_string(), tx);

        match timeout(Duration::from_secs(PERMISSION_TIMEOUT_SECS), rx).await {
            Ok(Ok(response)) => Some(response),
            _ => {
                // Timeout or channel closed — clean up
                self.pending.lock().remove(request_id);
                None
            }
        }
    }

    /// Called by Tauri command when UI sends a permission decision.
    pub fn respond(&self, request_id: &str, decision: &str, reason: Option<&str>) -> Result<(), String> {
        let tx = self.pending.lock().remove(request_id)
            .ok_or_else(|| format!("No pending permission for {}", request_id))?;

        let response = serde_json::json!({
            "decision": decision,
            "reason": reason.unwrap_or("")
        });

        tx.send(response.to_string())
            .map_err(|_| "Bridge connection closed".to_string())
    }
}
