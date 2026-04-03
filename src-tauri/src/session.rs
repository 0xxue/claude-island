use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub agent: String,
    pub terminal_type: Option<String>,
    pub terminal_id: Option<String>,
    pub pid: Option<u32>,
    pub state: SessionState,
    pub start_time: u64,
    pub last_event_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionState {
    Active,
    Idle,
    Waiting,
    Permission,
    Ended,
}

pub struct SessionManager {
    sessions: HashMap<String, SessionInfo>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self { sessions: HashMap::new() }
    }

    pub fn handle_event(&mut self, event: &ws_server_types::BridgeMessage) {
        let session_id = event.session_id.clone().unwrap_or_else(|| "unknown".into());
        let now = event.timestamp.unwrap_or_else(|| now_ms());

        match event.event_type.as_str() {
            "start" => {
                self.sessions.insert(session_id.clone(), SessionInfo {
                    session_id,
                    agent: event.agent.clone().unwrap_or_else(|| "claude".into()),
                    terminal_type: event.terminal.as_ref().map(|t| t.terminal_type.clone()),
                    terminal_id: event.terminal.as_ref().and_then(|t| t.id.clone()),
                    pid: event.terminal.as_ref().and_then(|t| t.pid),
                    state: SessionState::Active,
                    start_time: now,
                    last_event_time: now,
                });
            }
            "end" => {
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    s.state = SessionState::Ended;
                    s.last_event_time = now;
                }
            }
            "tool_start" => {
                self.ensure_session(&session_id, event, now);
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    s.state = SessionState::Active;
                    s.last_event_time = now;
                }
            }
            "tool_done" => {
                self.ensure_session(&session_id, event, now);
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    s.state = SessionState::Idle;
                    s.last_event_time = now;
                }
            }
            "permission" => {
                self.ensure_session(&session_id, event, now);
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    s.state = SessionState::Permission;
                    s.last_event_time = now;
                }
            }
            "stop" => {
                self.ensure_session(&session_id, event, now);
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    s.state = SessionState::Waiting;
                    s.last_event_time = now;
                }
            }
            _ => {}
        }
    }

    fn ensure_session(&mut self, id: &str, event: &ws_server_types::BridgeMessage, now: u64) {
        if !self.sessions.contains_key(id) {
            self.sessions.insert(id.to_string(), SessionInfo {
                session_id: id.to_string(),
                agent: event.agent.clone().unwrap_or_else(|| "claude".into()),
                terminal_type: event.terminal.as_ref().map(|t| t.terminal_type.clone()),
                terminal_id: event.terminal.as_ref().and_then(|t| t.id.clone()),
                pid: event.terminal.as_ref().and_then(|t| t.pid),
                state: SessionState::Active,
                start_time: now,
                last_event_time: now,
            });
        }
    }

    pub fn list(&self) -> Vec<SessionInfo> {
        self.sessions.values()
            .filter(|s| s.state != SessionState::Ended)
            .cloned()
            .collect()
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// Shared types used by both session and ws_server
pub mod ws_server_types {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Deserialize, Serialize, Clone)]
    pub struct BridgeMessage {
        #[serde(rename = "type")]
        pub event_type: String,
        pub agent: Option<String>,
        pub timestamp: Option<u64>,
        #[serde(rename = "sessionId")]
        pub session_id: Option<String>,
        pub cwd: Option<String>,
        pub source: Option<String>,
        pub tool: Option<String>,
        pub file: Option<String>,
        pub command: Option<String>,
        pub pattern: Option<String>,
        pub query: Option<String>,
        pub message: Option<String>,
        pub title: Option<String>,
        pub terminal: Option<TerminalInfo>,
        #[serde(rename = "requestId")]
        pub request_id: Option<String>,
        pub code: Option<serde_json::Value>,
    }

    #[derive(Debug, Deserialize, Serialize, Clone)]
    pub struct TerminalInfo {
        #[serde(rename = "type")]
        pub terminal_type: String,
        pub id: Option<String>,
        pub pid: Option<u32>,
    }
}
