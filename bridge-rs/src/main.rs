use std::env;
use std::io::Read;
use std::time::Duration;
use tokio_tungstenite::connect_async;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

const WS_URL: &str = "ws://127.0.0.1:19432";
const CONNECT_TIMEOUT: Duration = Duration::from_millis(2000);
const PERMISSION_TIMEOUT: Duration = Duration::from_secs(9);

// ═══ Data Structures ═══

#[derive(Debug, Serialize)]
struct BridgeEvent {
    #[serde(rename = "type")]
    event_type: String,
    agent: String,
    timestamp: u64,
    #[serde(rename = "sessionId")]
    session_id: String,
    cwd: String,
    source: String,
    terminal: TerminalInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pattern: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<serde_json::Value>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    request_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct TerminalInfo {
    #[serde(rename = "type")]
    terminal_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pid: Option<u32>,
}

#[derive(Debug, Deserialize, Default)]
struct StdinData {
    session_id: Option<String>,
    cwd: Option<String>,
    tool_name: Option<String>,
    tool_input: Option<serde_json::Value>,
    message: Option<String>,
    title: Option<String>,
    last_assistant_message: Option<String>,
    // Gemini-specific
    hook_event_name: Option<String>,
    tool_response: Option<serde_json::Value>,
}

// ═══ CLI Args ═══

struct Args {
    event_type: String,
    agent: String,
}

fn parse_args() -> Args {
    let args: Vec<String> = env::args().collect();
    let mut event_type = "stop".to_string();
    let mut agent = "claude".to_string();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--event" if i + 1 < args.len() => {
                event_type = args[i + 1].clone();
                i += 2;
            }
            "--agent" if i + 1 < args.len() => {
                agent = args[i + 1].clone();
                i += 2;
            }
            _ => { i += 1; }
        }
    }

    // Map Gemini event names to unified names
    event_type = match event_type.as_str() {
        "BeforeTool" => "tool_start".into(),
        "AfterTool" => "tool_done".into(),
        "BeforeAgent" | "UserPromptSubmit" => "stop".into(),
        "AfterAgent" => "stop".into(),
        "SessionStart" => "start".into(),
        "SessionEnd" => "end".into(),
        "PreToolUse" => "tool_start".into(),
        "PostToolUse" => "tool_done".into(),
        "PermissionRequest" => "permission".into(),
        "Stop" => "stop".into(),
        "Notification" => "notification".into(),
        other => other.into(),
    };

    Args { event_type, agent }
}

// ═══ Terminal Detection ═══

fn detect_terminal() -> TerminalInfo {
    // Priority: most specific first
    if let Ok(session) = env::var("WT_SESSION") {
        return TerminalInfo {
            terminal_type: "windows-terminal".into(),
            id: Some(session),
            pid: None,
        };
    }
    if let Ok(pid) = env::var("VSCODE_PID") {
        // Check if it's Cursor (VS Code fork)
        let t = if env::var("CURSOR_TRACE_DIR").is_ok() { "cursor" } else { "vscode" };
        return TerminalInfo {
            terminal_type: t.into(),
            id: Some(pid),
            pid: None,
        };
    }
    if env::var("MSYSTEM").is_ok() {
        return TerminalInfo {
            terminal_type: "git-bash".into(),
            id: None,
            pid: Some(std::process::id()),
        };
    }
    if let Ok(tmux) = env::var("TMUX") {
        return TerminalInfo {
            terminal_type: "tmux".into(),
            id: Some(tmux),
            pid: None,
        };
    }
    if let Ok(id) = env::var("ITERM_SESSION_ID") {
        return TerminalInfo {
            terminal_type: "iterm2".into(),
            id: Some(id),
            pid: None,
        };
    }
    if let Ok(id) = env::var("KITTY_PID") {
        return TerminalInfo {
            terminal_type: "kitty".into(),
            id: Some(id),
            pid: None,
        };
    }
    if env::var("WSL_DISTRO_NAME").is_ok() {
        return TerminalInfo {
            terminal_type: "wsl".into(),
            id: env::var("WSL_DISTRO_NAME").ok(),
            pid: Some(std::process::id()),
        };
    }

    // Fallback
    let t = if env::var("PSModulePath").is_ok() { "powershell" } else { "cmd" };
    TerminalInfo {
        terminal_type: t.into(),
        id: None,
        pid: Some(std::process::id()),
    }
}

fn detect_source() -> String {
    if env::var("VSCODE_PID").is_ok() || env::var("VSCODE_CWD").is_ok() {
        if env::var("CURSOR_TRACE_DIR").is_ok() {
            "cursor".into()
        } else {
            "claude-vscode".into()
        }
    } else {
        "cli".into()
    }
}

// ═══ Tool Name Mapping ═══

fn map_tool_name(agent: &str, tool: &str) -> String {
    if agent == "gemini" {
        match tool {
            "replace" => "Edit",
            "run_shell_command" => "Bash",
            "read_file" => "Read",
            "write_file" => "Write",
            "glob" => "Glob",
            "grep" => "Grep",
            "ls" => "LS",
            other => other,
        }
        .to_string()
    } else {
        tool.to_string()
    }
}

// ═══ Read Stdin ═══

fn read_stdin_with_timeout() -> String {
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = std::io::stdin().read_to_string(&mut buf);
        let _ = tx.send(buf);
    });

    // Wait up to 100ms for stdin data
    rx.recv_timeout(Duration::from_millis(100))
        .unwrap_or_default()
}

// ═══ Main ═══

#[tokio::main]
async fn main() {
    let args = parse_args();
    let stdin_data = read_stdin_with_timeout();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let terminal = detect_terminal();
    let source = detect_source();

    // Build event
    let mut event = BridgeEvent {
        event_type: args.event_type.clone(),
        agent: args.agent.clone(),
        timestamp: now,
        session_id: env::var("session_id").unwrap_or_default(),
        cwd: env::var("cwd").unwrap_or_default(),
        source,
        terminal,
        tool: None,
        file: None,
        command: None,
        pattern: None,
        query: None,
        message: None,
        title: None,
        code: None,
        request_id: None,
    };

    // Parse stdin JSON
    if !stdin_data.is_empty() {
        if let Ok(data) = serde_json::from_str::<StdinData>(&stdin_data) {
            // session_id from stdin (Codex/Gemini) or keep env var (Claude)
            if let Some(sid) = data.session_id {
                if !sid.is_empty() {
                    event.session_id = sid;
                }
            }
            if let Some(cwd) = data.cwd {
                if !cwd.is_empty() {
                    event.cwd = cwd;
                }
            }

            // Tool info
            if let Some(tool) = data.tool_name {
                event.tool = Some(map_tool_name(&args.agent, &tool));
            }
            if let Some(input) = &data.tool_input {
                event.file = input
                    .get("file_path")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                event.command = input
                    .get("command")
                    .and_then(|v| v.as_str())
                    .map(|s| s.chars().take(100).collect());
                event.pattern = input
                    .get("pattern")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                event.query = input
                    .get("query")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
            }

            // Message
            event.message = data
                .message
                .or(data.last_assistant_message)
                .map(|s| s.chars().take(150).collect());
            event.title = data.title;
        }
    }

    // Generate requestId for permission events
    if event.event_type == "permission" {
        event.request_id = Some(uuid::Uuid::new_v4().to_string());
    }

    // Connect to WebSocket
    let connect_result = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(WS_URL)).await;

    let ws_stream = match connect_result {
        Ok(Ok((ws, _))) => ws,
        _ => return, // Island not running, exit silently
    };

    let (mut write, mut read) = ws_stream.split();

    // Send event
    let msg_json = serde_json::to_string(&event).unwrap();
    if write
        .send(tokio_tungstenite::tungstenite::Message::Text(msg_json))
        .await
        .is_err()
    {
        return;
    }

    // Permission mode: wait for response from island UI
    if event.event_type == "permission" {
        let timeout_result = tokio::time::timeout(PERMISSION_TIMEOUT, read.next()).await;

        match timeout_result {
            Ok(Some(Ok(msg))) => {
                if let Ok(text) = msg.to_text() {
                    // Write response to stdout for the hook system
                    print!("{}", text);
                }
            }
            _ => {
                // Timeout or error: output default allow
                print!(r#"{{"decision":"allow","reason":"timeout"}}"#);
            }
        }
    }

    // Close connection
    let _ = write.close().await;
}
