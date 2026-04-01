#!/usr/bin/env node
const WebSocket = require('ws');
const PORT = 19432;

const args = process.argv.slice(2);
let eventType = 'stop';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--event' && args[i + 1]) eventType = args[++i];
}

function detectSource() {
  // VSCODE_PID only exists in VS Code's integrated terminal
  if (process.env.VSCODE_PID || process.env.VSCODE_CWD || process.env.TERM_PROGRAM === 'vscode') {
    return 'claude-vscode';
  }
  // If none of the VS Code env vars exist, it's a standalone terminal
  return 'cli';
}

let stdinBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { stdinBuf += c; });

setTimeout(() => {
  const source = detectSource();
  const event = {
    type: eventType,
    timestamp: Date.now(),
    sessionId: process.env.session_id || '',
    cwd: process.env.cwd || '',
    source: source,
  };

  if (stdinBuf) {
    try {
      const d = JSON.parse(stdinBuf);
      if (d.tool_name) event.tool = d.tool_name;
      if (d.tool_input) {
        if (d.tool_input.file_path) event.file = d.tool_input.file_path;
        if (d.tool_input.command) event.command = d.tool_input.command.substring(0, 100);
        if (d.tool_input.pattern) event.pattern = d.tool_input.pattern;
        if (d.tool_input.query) event.query = d.tool_input.query;
      }
      if (d.message) event.message = d.message;
      if (d.title) event.title = d.title;
      if (d.last_assistant_message) event.message = d.last_assistant_message.substring(0, 150);
    } catch {}
  }

  const ws = new WebSocket('ws://127.0.0.1:' + PORT);
  ws.on('open', () => { ws.send(JSON.stringify(event)); ws.close(); process.exit(0); });
  ws.on('error', () => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}, 80);
