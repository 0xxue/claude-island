#[cfg(target_os = "windows")]
pub fn focus_window(source: &str, terminal_type: Option<&str>, terminal_id: Option<&str>, cwd: Option<&str>) {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::System::Threading::*;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    struct FindData {
        target_pid: Option<u32>,
        target_title: Option<String>,
        found: HWND,
    }

    unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data = &mut *(lparam.0 as *mut FindData);
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }

        if let Some(pid) = data.target_pid {
            let mut proc_id: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut proc_id));
            if proc_id == pid {
                data.found = hwnd;
                return BOOL(0);
            }
        }

        if let Some(ref title) = data.target_title {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);
            if len > 0 {
                let text = OsString::from_wide(&buf[..len as usize])
                    .to_string_lossy()
                    .to_lowercase();
                if text.contains(&title.to_lowercase()) {
                    data.found = hwnd;
                    return BOOL(0);
                }
            }
        }

        BOOL(1)
    }

    fn find(pid: Option<u32>, title: Option<&str>) -> Option<HWND> {
        let mut data = FindData {
            target_pid: pid,
            target_title: title.map(|s| s.to_string()),
            found: HWND::default(),
        };
        unsafe {
            let _ = EnumWindows(Some(enum_cb), LPARAM(&mut data as *mut _ as isize));
        }
        if !data.found.0.is_null() {
            Some(data.found)
        } else {
            None
        }
    }

    /// Walk up the process tree from a PID, find the first process with a visible window
    fn find_ancestor_window(start_pid: u32) -> Option<HWND> {
        let mut pid = start_pid;
        for _ in 0..10 { // max 10 levels up
            if let Some(hwnd) = find(Some(pid), None) {
                return Some(hwnd);
            }
            // Get parent PID
            match get_parent_pid(pid) {
                Some(ppid) if ppid != pid && ppid != 0 => pid = ppid,
                _ => break,
            }
        }
        None
    }

    fn get_parent_pid(pid: u32) -> Option<u32> {
        use windows::Win32::System::Diagnostics::ToolHelp::*;
        unsafe {
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
            let mut entry = PROCESSENTRY32W::default();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            if Process32FirstW(snap, &mut entry).is_ok() {
                loop {
                    if entry.th32ProcessID == pid {
                        let _ = windows::Win32::Foundation::CloseHandle(snap);
                        return Some(entry.th32ParentProcessID);
                    }
                    if Process32NextW(snap, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = windows::Win32::Foundation::CloseHandle(snap);
        }
        None
    }

    fn activate(hwnd: HWND) {
        unsafe {
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
        }
    }

    // Strategy 1: PID-based — walk up from bridge PID to find terminal window
    if let Some(id) = terminal_id {
        if let Ok(pid) = id.parse::<u32>() {
            if let Some(hwnd) = find_ancestor_window(pid) {
                activate(hwnd);
                return;
            }
        }
    }

    // Strategy 2: VSCODE_PID — direct PID match
    if let (_, Some("vscode")) | ("claude-vscode", _) = (source, terminal_type) {
        if let Some(id) = terminal_id {
            if let Ok(pid) = id.parse::<u32>() {
                if let Some(hwnd) = find(Some(pid), None) {
                    activate(hwnd);
                    return;
                }
            }
        }
    }

    // Strategy 3: cwd directory name in window title
    if let Some(cwd) = cwd {
        let dir_name = cwd.replace('\\', "/").split('/').last().unwrap_or("").to_string();
        if !dir_name.is_empty() {
            if let Some(hwnd) = find(None, Some(&dir_name)) {
                activate(hwnd);
                return;
            }
        }
    }

    // Strategy 4: terminal type name matching
    let hwnd = match (source, terminal_type) {
        (_, Some("windows-terminal")) => find(None, Some("Windows Terminal")),
        (_, Some("vscode")) => find(None, Some("Visual Studio Code")),
        (_, Some("cursor")) => find(None, Some("Cursor")),
        (_, Some("mintty")) => {
            find(None, Some("MINGW"))
                .or_else(|| find(None, Some("bash")))
                .or_else(|| find(None, Some("mintty")))
        }
        _ => {
            find(None, Some("Windows Terminal"))
                .or_else(|| find(None, Some("Visual Studio Code")))
                .or_else(|| find(None, Some("cmd")))
        }
    };

    if let Some(hwnd) = hwnd {
        activate(hwnd);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn focus_window(_source: &str, _terminal_type: Option<&str>, _terminal_id: Option<&str>, _cwd: Option<&str>) {
    // macOS/Linux: TODO
}
