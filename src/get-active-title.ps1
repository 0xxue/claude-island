Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name FG -Namespace FG
Add-Type -MemberDefinition '[DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);' -Name GT -Namespace GT
$hwnd = [FG.FG]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[GT.GT]::GetWindowText($hwnd, $sb, 256) | Out-Null
Write-Output $sb.ToString()
