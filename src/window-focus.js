const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function focusClaude(source) {
  const psScript = path.join(__dirname, '..', '_focus.ps1');

  var script;
  if (source === 'cli') {
    script = [
      '$shell = New-Object -ComObject WScript.Shell',
      '$wt = Get-Process WindowsTerminal -ErrorAction SilentlyContinue',
      'if ($wt) { $shell.AppActivate($wt.Id); exit 0 }',
      '$cm = Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }',
      'if ($cm) { $shell.AppActivate($cm[0].Id); exit 0 }',
    ].join('\n');
  } else {
    script = [
      '$shell = New-Object -ComObject WScript.Shell',
      '$shell.AppActivate("Visual Studio Code") | Out-Null',
    ].join('\n');
  }

  fs.writeFileSync(psScript, script);
  exec('powershell -ExecutionPolicy Bypass -File "' + psScript + '"', function(err) {
    try { fs.unlinkSync(psScript); } catch(e) {}
  });
}

module.exports = { focusClaude };
