use std::env;
use std::io::Read;
use std::time::Duration;
use tokio_tungstenite::connect_async;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
fn get_console_hwnd() -> Option<u64> {
    unsafe {
        let hwnd = windows_sys::Win32::System::Console::GetConsoleWindow();
        if hwnd.is_null() { None } else { Some(hwnd as u64) }
    }
}

#[cfg(target_os = "windows")]
fn get_foreground_hwnd() -> Option<u64> {
    unsafe {
        let hwnd = windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow();
        if hwnd.is_null() { None } else { Some(hwnd as u64) }
    }
}

#[cfg(not(target_os = "windows"))]
fn get_console_hwnd() -> Option<u64> { None }
#[cfg(not(target_os = "windows"))]
fn get_foreground_hwnd() -> Option<u64> { None }

#[cfg(target_os = "windows")]
fn find_window_by_pid(target_pid: u32) -> Option<u64> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    use windows_sys::Win32::Foundation::HWND;
    unsafe {
        let mut hwnd: HWND = FindWindowExW(std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null(), std::ptr::null());
        while !hwnd.is_null() {
            let mut proc_id: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut proc_id);
            if proc_id == target_pid && IsWindowVisible(hwnd) != 0 {
                return Some(hwnd as u64);
            }
            hwnd = FindWindowExW(std::ptr::null_mut(), hwnd, std::ptr::null(), std::ptr::null());
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn find_window_by_pid(_pid: u32) -> Option<u64> { None }

#[cfg(target_os = "windows")]
fn find_specific_ancestor(start_pid: u32, target_name: &str) -> Option<u32> {
    use std::mem;
    let mut pid = start_pid;
    let target = target_name.to_lowercase();

    unsafe {
        let snap = windows_sys::Win32::System::Diagnostics::ToolHelp::CreateToolhelp32Snapshot(
            windows_sys::Win32::System::Diagnostics::ToolHelp::TH32CS_SNAPPROCESS, 0);
        if snap == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE { return None; }

        for _ in 0..15 {
            let mut entry: windows_sys::Win32::System::Diagnostics::ToolHelp::PROCESSENTRY32W = mem::zeroed();
            entry.dwSize = mem::size_of::<windows_sys::Win32::System::Diagnostics::ToolHelp::PROCESSENTRY32W>() as u32;

            if windows_sys::Win32::System::Diagnostics::ToolHelp::Process32FirstW(snap, &mut entry) != 0 {
                loop {
                    if entry.th32ProcessID == pid {
                        let name: String = entry.szExeFile.iter()
                            .take_while(|&&c| c != 0)
                            .map(|&c| char::from(c as u8))
                            .collect::<String>()
                            .to_lowercase();
                        if name == target {
                            windows_sys::Win32::Foundation::CloseHandle(snap);
                            return Some(pid);
                        }
                        pid = entry.th32ParentProcessID;
                        break;
                    }
                    if windows_sys::Win32::System::Diagnostics::ToolHelp::Process32NextW(snap, &mut entry) == 0 {
                        windows_sys::Win32::Foundation::CloseHandle(snap);
                        return None;
                    }
                }
            } else {
                break;
            }
            if pid == 0 { break; }
        }
        windows_sys::Win32::Foundation::CloseHandle(snap);
    }
    None
}

#[cfg(target_os = "windows")]
fn find_terminal_pid() -> Option<u32> {
    // Walk up process tree to find the terminal host (cmd.exe, powershell, mintty, etc.)
    use std::mem;
    let mut pid = std::process::id();
    let terminal_names = ["cmd.exe", "powershell.exe", "pwsh.exe", "mintty.exe",
                          "windowsterminal.exe", "code.exe", "cursor.exe",
                          "conhost.exe", "bash.exe"];

    unsafe {
        let snap = windows_sys::Win32::System::Diagnostics::ToolHelp::CreateToolhelp32Snapshot(
            windows_sys::Win32::System::Diagnostics::ToolHelp::TH32CS_SNAPPROCESS, 0);
        if snap == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            return None;
        }

        for _ in 0..15 {
            // Get parent PID
            let mut entry: windows_sys::Win32::System::Diagnostics::ToolHelp::PROCESSENTRY32W = mem::zeroed();
            entry.dwSize = mem::size_of::<windows_sys::Win32::System::Diagnostics::ToolHelp::PROCESSENTRY32W>() as u32;

            let mut found_parent = None;
            if windows_sys::Win32::System::Diagnostics::ToolHelp::Process32FirstW(snap, &mut entry) != 0 {
                loop {
                    if entry.th32ProcessID == pid {
                        found_parent = Some(entry.th32ParentProcessID);
                        // Check process name
                        let name: String = entry.szExeFile.iter()
                            .take_while(|&&c| c != 0)
                            .map(|&c| char::from(c as u8))
                            .collect::<String>()
                            .to_lowercase();
                        // If current process is a terminal, return its PID
                        if terminal_names.iter().any(|t| name == *t) {
                            windows_sys::Win32::Foundation::CloseHandle(snap);
                            return Some(pid);
                        }
                        break;
                    }
                    if windows_sys::Win32::System::Diagnostics::ToolHelp::Process32NextW(snap, &mut entry) == 0 {
                        break;
                    }
                }
            }

            match found_parent {
                Some(ppid) if ppid != pid && ppid != 0 => pid = ppid,
                _ => break,
            }
        }
        windows_sys::Win32::Foundation::CloseHandle(snap);
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn find_terminal_pid() -> Option<u32> { None }

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
    /// Console window handle (HWND as u64) — unique per terminal window
    #[serde(skip_serializing_if = "Option::is_none")]
    hwnd: Option<u64>,
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
    /// Codex notify passes JSON as last CLI arg (not stdin)
    cli_json: Option<String>,
}

fn parse_args() -> Args {
    let args: Vec<String> = env::args().collect();
    let mut event_type = "stop".to_string();
    let mut agent = "claude".to_string();
    let mut cli_json = None;

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
            s if s.starts_with('{') => {
                // Codex notify: JSON passed as CLI argument
                cli_json = Some(s.to_string());
                i += 1;
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

    Args { event_type, agent, cli_json }
}

// ═══ Terminal Detection ═══

fn detect_terminal() -> TerminalInfo {
    let console_hwnd = get_console_hwnd();

    // Priority: host window first, then shell type
    if let Ok(session) = env::var("WT_SESSION") {
        return TerminalInfo {
            terminal_type: "windows-terminal".into(),
            id: Some(session),
            pid: None,
            hwnd: console_hwnd,
        };
    }
    if let Ok(pid) = env::var("VSCODE_PID") {
        let t = if env::var("CURSOR_TRACE_DIR").is_ok() { "cursor" } else { "vscode" };
        return TerminalInfo {
            terminal_type: t.into(),
            id: Some(pid),
            pid: None,
            hwnd: console_hwnd,
        };
    }
    // CMD check — PROMPT exists in CMD environment (even with Git in PATH)
    // This must come before MSYSTEM check since CMD can have MSYSTEM set
    if console_hwnd.is_some() && env::var("PROMPT").is_ok() {
        return TerminalInfo {
            terminal_type: "cmd".into(),
            id: None,
            pid: Some(std::process::id()),
            hwnd: console_hwnd,
        };
    }
    // MSYSTEM without console = standalone mintty (Git Bash)
    // Fall through to other checks
    if let Ok(tmux) = env::var("TMUX") {
        return TerminalInfo {
            terminal_type: "tmux".into(),
            id: Some(tmux),
            pid: None, hwnd: console_hwnd,
        };
    }
    if let Ok(id) = env::var("ITERM_SESSION_ID") {
        return TerminalInfo {
            terminal_type: "iterm2".into(),
            id: Some(id),
            pid: None, hwnd: console_hwnd,
        };
    }
    if let Ok(id) = env::var("KITTY_PID") {
        return TerminalInfo {
            terminal_type: "kitty".into(),
            id: Some(id),
            pid: None, hwnd: console_hwnd,
        };
    }
    if env::var("WSL_DISTRO_NAME").is_ok() {
        return TerminalInfo {
            terminal_type: "wsl".into(),
            id: env::var("WSL_DISTRO_NAME").ok(),
            pid: Some(std::process::id()),
            hwnd: console_hwnd,
        };
    }

    // Fallback: standalone terminal
    let t = if env::var("MSYSTEM").is_ok() {
        "mintty"
    } else if env::var("PSModulePath").is_ok() {
        "powershell"
    } else {
        "cmd"
    };
    // Find the actual terminal window HWND
    let term_hwnd = if console_hwnd.is_some() {
        console_hwnd
    } else {
        // Try common terminal hosts in order
        find_specific_ancestor(std::process::id(), "mintty.exe")
            .or_else(|| find_specific_ancestor(std::process::id(), "cmd.exe"))
            .or_else(|| find_specific_ancestor(std::process::id(), "powershell.exe"))
            .or_else(|| find_specific_ancestor(std::process::id(), "pwsh.exe"))
            .or_else(|| find_specific_ancestor(std::process::id(), "windowsterminal.exe"))
            .and_then(|pid| find_window_by_pid(pid))
    };
    TerminalInfo {
        terminal_type: t.into(),
        id: None,
        pid: Some(std::process::id()),
        hwnd: term_hwnd,
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
    // Capture foreground window IMMEDIATELY — terminal is still foreground
    let fg_hwnd = get_foreground_hwnd();

    let args = parse_args();
    // Codex notify: JSON comes as CLI arg. Claude/Gemini: JSON comes from stdin.
    let stdin_data = if let Some(ref json) = args.cli_json {
        json.clone()
    } else {
        read_stdin_with_timeout()
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let terminal = detect_terminal();
    // No foreground fallback — it captures wrong windows (games etc)
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
