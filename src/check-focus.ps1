Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name FG -Namespace FG
$hwnd = [FG.FG]::GetForegroundWindow()
$proc = Get-Process | Where-Object { $_.MainWindowHandle -eq $hwnd }
Write-Output $proc.ProcessName
