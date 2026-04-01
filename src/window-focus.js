const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function focusClaude() {
  const psScript = path.join(__dirname, '..', '_focus.ps1');

  // Find the window whose title contains "claude" (case insensitive)
  // This works for both CMD (title shows "claude") and VS Code terminal
  fs.writeFileSync(psScript, `
$shell = New-Object -ComObject WScript.Shell
# First try: find window with "claude" in title (CMD/Terminal running claude)
$procs = Get-Process | Where-Object { $_.MainWindowTitle -match 'claude|Claude' }
foreach ($p in $procs) {
    if ($p.ProcessName -ne 'electron') {
        if ($shell.AppActivate($p.Id)) { exit 0 }
    }
}
# Fallback: try common targets
$targets = @('WindowsTerminal', 'cmd', 'Visual Studio Code')
foreach ($t in $targets) {
    if ($shell.AppActivate($t)) { exit 0 }
}
`);

  exec(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, (err) => {
    if (err) console.error('[Focus] Error:', err.message);
    try { fs.unlinkSync(psScript); } catch {}
  });
}

module.exports = { focusClaude };
