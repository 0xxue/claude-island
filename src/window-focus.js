const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function focusClaude() {
  // Write a temp PowerShell script to avoid escaping issues
  const psScript = path.join(__dirname, '..', '_focus.ps1');
  fs.writeFileSync(psScript, `
$shell = New-Object -ComObject WScript.Shell
$targets = @('Visual Studio Code', 'WindowsTerminal', 'cmd', 'PowerShell')
foreach ($t in $targets) {
    if ($shell.AppActivate($t)) {
        Write-Host "Focused: $t"
        exit 0
    }
}
Write-Host "No window found"
`);

  exec(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, (err, stdout, stderr) => {
    console.log('[Focus]', stdout.trim());
    if (err) console.error('[Focus] Error:', err.message);
    // Clean up
    try { fs.unlinkSync(psScript); } catch {}
  });
}

module.exports = { focusClaude };
