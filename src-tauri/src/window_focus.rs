#[cfg(target_os = "windows")]
pub fn focus_window(source: &str, terminal_type: Option<&str>, terminal_id: Option<&str>) {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::*;
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

    fn activate(hwnd: HWND) {
        unsafe {
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
        }
    }

    // Find window based on terminal info
    let hwnd = match (source, terminal_type) {
        (_, Some("windows-terminal")) => find(None, Some("Windows Terminal")),
        (_, Some("vscode")) | ("claude-vscode", _) => {
            if let Some(id) = terminal_id {
                if let Ok(pid) = id.parse::<u32>() {
                    find(Some(pid), None)
                } else {
                    find(None, Some("Visual Studio Code"))
                }
            } else {
                find(None, Some("Visual Studio Code"))
            }
        }
        (_, Some("cursor")) => find(None, Some("Cursor")),
        (_, Some("git-bash")) => {
            find(None, Some("MINGW"))
                .or_else(|| find(None, Some("bash")))
                .or_else(|| find(None, Some("Git Bash")))
                .or_else(|| find(None, Some("mintty")))
                .or_else(|| find(None, Some("Windows Terminal")))
        }
        ("cli", _) | (_, Some("cmd")) | (_, Some("powershell")) => {
            find(None, Some("Windows Terminal"))
                .or_else(|| find(None, Some("Windows PowerShell")))
                .or_else(|| find(None, Some("cmd.exe")))
        }
        _ => {
            find(None, Some("Windows Terminal"))
                .or_else(|| find(None, Some("Visual Studio Code")))
        }
    };

    if let Some(hwnd) = hwnd {
        activate(hwnd);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn focus_window(_source: &str, _terminal_type: Option<&str>, _terminal_id: Option<&str>) {
    // macOS/Linux: TODO
}
