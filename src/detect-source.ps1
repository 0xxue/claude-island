param([int]$StartPid)
$chain = @()
$cpid = $StartPid
for ($i = 0; $i -lt 10; $i++) {
    if ($cpid -le 0) { break }
    $p = Get-Process -Id $cpid -ErrorAction SilentlyContinue
    if (-not $p) { break }
    $chain += $p.ProcessName.ToLower()
    $wmi = Get-CimInstance Win32_Process -Filter "ProcessId=$cpid" -ErrorAction SilentlyContinue
    if (-not $wmi) { break }
    $cpid = $wmi.ParentProcessId
}

if ($chain -contains 'code') {
    Write-Output 'claude-vscode'
    exit 0
}

if ($chain -contains 'windowsterminal' -or $chain -contains 'cmd' -or $chain -contains 'powershell' -or $chain -contains 'pwsh') {
    Write-Output 'cli'
    exit 0
}

Write-Output 'unknown'
