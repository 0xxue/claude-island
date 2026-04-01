#!/usr/bin/env node
/**
 * Claude Island Bridge — reads hook data from stdin + args, sends to Island app.
 */
const WebSocket = require('ws');
const PORT = 19432;

const args = process.argv.slice(2);
let eventType = 'stop';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--event' && args[i + 1]) eventType = args[++i];
}

// Read stdin (Claude Code passes JSON hook data)
let stdinBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { stdinBuf += c; });

setTimeout(() => {
  const event = {
    type: eventType,
    timestamp: Date.now(),
    sessionId: process.env.session_id || '',
    cwd: process.env.cwd || '',
    source: process.env.TERM_PROGRAM === 'vscode' ? 'vscode' : process.env.WT_SESSION ? 'terminal' : (process.env.VSCODE_PID ? 'vscode' : 'terminal'),
  };

  // Parse stdin JSON for rich data
  if (stdinBuf) {
    try {
      const d = JSON.parse(stdinBuf);
      // PreToolUse / PostToolUse
      if (d.tool_name) event.tool = d.tool_name;
      if (d.tool_input) {
        event.toolInput = typeof d.tool_input === 'string' ? d.tool_input : JSON.stringify(d.tool_input).substring(0, 200);
        // Extract file path from tool input
        if (d.tool_input.file_path) event.file = d.tool_input.file_path;
        if (d.tool_input.command) event.command = d.tool_input.command.substring(0, 100);
        if (d.tool_input.pattern) event.pattern = d.tool_input.pattern;
        if (d.tool_input.query) event.query = d.tool_input.query;
      }
      // PermissionRequest
      if (d.permission_suggestions) event.suggestions = d.permission_suggestions;
      // Stop
      if (d.last_assistant_message) event.message = d.last_assistant_message.substring(0, 150);
      // Notification
      if (d.message) event.message = d.message;
      if (d.title) event.title = d.title;
    } catch {}
  }

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  ws.on('open', () => { ws.send(JSON.stringify(event)); ws.close(); process.exit(0); });
  ws.on('error', () => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}, 80);
