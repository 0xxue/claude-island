#[cfg(target_os = "windows")]
pub fn focus_window(source: &str, terminal_type: Option<&str>, terminal_id: Option<&str>, cwd: Option<&str>, hwnd: Option<u64>) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::System::Threading::GetCurrentThreadId;

    fn activate(hwnd: HWND) {
        unsafe {
            // Trick Windows into allowing SetForegroundWindow from background process:
            // Attach to the foreground thread, then set, then detach
            let fg = GetForegroundWindow();
            let fg_thread = windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(fg, None);
            let cur_thread = windows::Win32::System::Threading::GetCurrentThreadId();
            if fg_thread != cur_thread {
                windows::Win32::UI::WindowsAndMessaging::AttachThreadInput(cur_thread, fg_thread, true);
            }
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
            if fg_thread != cur_thread {
                windows::Win32::UI::WindowsAndMessaging::AttachThreadInput(cur_thread, fg_thread, false);
            }
        }
    }

    // Strategy 1: direct HWND from bridge (most precise — unique per console window)
    if let Some(h) = hwnd {
        if h != 0 {
            let win_hwnd = HWND(h as *mut std::ffi::c_void);
            activate(win_hwnd);
            return;
        }
    }

    // Strategy 2: terminal PID (e.g. mintty PID — persistent, unique per window)
    if let Some(id) = terminal_id {
        if let Ok(pid) = id.parse::<u32>() {
            if let Some(h) = find_by_pid(pid) {
                activate(h);
                return;
            }
        }
    }

    // Strategy 3: VSCODE_PID
    if let Some("vscode") | Some("cursor") = terminal_type {
        if let Some(id) = terminal_id {
            if let Ok(pid) = id.parse::<u32>() {
                if let Some(h) = find_by_pid(pid) {
                    activate(h);
                    return;
                }
            }
        }
    }

    // Strategy 3: cwd in window title — try progressively shorter paths
    if let Some(cwd) = cwd {
        let normalized = cwd.replace('\\', "/");
        let parts: Vec<&str> = normalized.split('/').filter(|s| !s.is_empty()).collect();
        // Try last 2 parts, then last 1 part (more specific first)
        if parts.len() >= 2 {
            let two = format!("{}/{}", parts[parts.len()-2], parts[parts.len()-1]);
            if let Some(h) = find_by_title(&two) {
                activate(h);
                return;
            }
        }
        if let Some(last) = parts.last() {
            if !last.is_empty() && last.to_lowercase() != "administrator" && last.to_lowercase() != "users" {
                if let Some(h) = find_by_title(last) {
                    activate(h);
                    return;
                }
            }
        }
    }

    // Strategy 4: terminal type fallback
    let h = match terminal_type {
        Some("windows-terminal") => find_by_title("Windows Terminal"),
        Some("vscode") => find_by_title("Visual Studio Code"),
        Some("cursor") => find_by_title("Cursor"),
        _ => find_by_title("Windows Terminal")
              .or_else(|| find_by_title("Visual Studio Code"))
              .or_else(|| find_by_title("cmd")),
    };
    if let Some(h) = h { activate(h); }
}

#[cfg(target_os = "windows")]
fn find_by_pid(pid: u32) -> Option<windows::Win32::Foundation::HWND> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::*;

    struct Data { pid: u32, found: HWND }
    unsafe extern "system" fn cb(hwnd: HWND, lp: LPARAM) -> BOOL {
        let d = &mut *(lp.0 as *mut Data);
        if !IsWindowVisible(hwnd).as_bool() { return BOOL(1); }
        let mut p: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut p));
        if p == d.pid { d.found = hwnd; return BOOL(0); }
        BOOL(1)
    }
    let mut d = Data { pid, found: HWND::default() };
    unsafe { let _ = EnumWindows(Some(cb), LPARAM(&mut d as *mut _ as isize)); }
    if !d.found.0.is_null() { Some(d.found) } else { None }
}

#[cfg(target_os = "windows")]
fn find_by_title(title: &str) -> Option<windows::Win32::Foundation::HWND> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::*;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    struct Data { title: String, found: HWND }
    unsafe extern "system" fn cb(hwnd: HWND, lp: LPARAM) -> BOOL {
        let d = &mut *(lp.0 as *mut Data);
        if !IsWindowVisible(hwnd).as_bool() { return BOOL(1); }
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buf);
        if len > 0 {
            let text = OsString::from_wide(&buf[..len as usize]).to_string_lossy().to_lowercase();
            if text.contains(&d.title.to_lowercase()) { d.found = hwnd; return BOOL(0); }
        }
        BOOL(1)
    }
    let mut d = Data { title: title.to_string(), found: HWND::default() };
    unsafe { let _ = EnumWindows(Some(cb), LPARAM(&mut d as *mut _ as isize)); }
    if !d.found.0.is_null() { Some(d.found) } else { None }
}

#[cfg(not(target_os = "windows"))]
pub fn focus_window(_: &str, _: Option<&str>, _: Option<&str>, _: Option<&str>, _: Option<u64>) {}
