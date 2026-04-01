#!/usr/bin/env node
/**
 * Claude Island Bridge — lightweight CLI invoked by Claude Code hooks.
 * Sends event to the running Island app via WebSocket, then exits.
 *
 * Usage (from hooks):
 *   node bridge.js --event stop
 *   node bridge.js --event permission --tool "Edit"
 *   node bridge.js --event notification --message "Task complete"
 */
const WebSocket = require('ws');

const PORT = 19432;
const args = process.argv.slice(2);

function parseArgs(args) {
  const result = { type: 'stop', tool: '', message: '' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--event' && args[i + 1]) result.type = args[++i];
    if (args[i] === '--tool' && args[i + 1]) result.tool = args[++i];
    if (args[i] === '--message' && args[i + 1]) result.message = args[++i];
  }
  // Also read from environment variables (Claude Code hook env)
  result.sessionId = process.env.session_id || '';
  result.cwd = process.env.cwd || '';
  result.timestamp = Date.now();
  return result;
}

const event = parseArgs(args);

// Also try to read stdin JSON (Claude Code passes hook data via stdin)
let stdinData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { stdinData += chunk; });

// Send after short delay to collect stdin
setTimeout(() => {
  if (stdinData) {
    try {
      const hookData = JSON.parse(stdinData);
      if (hookData.tool_name) event.tool = hookData.tool_name;
      if (hookData.message) event.message = hookData.message;
      if (hookData.last_assistant_message) {
        event.message = hookData.last_assistant_message.substring(0, 100);
      }
    } catch {}
  }

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);

  ws.on('open', () => {
    ws.send(JSON.stringify(event));
    ws.close();
    process.exit(0);
  });

  ws.on('error', () => {
    // Island app not running, silently exit
    process.exit(0);
  });

  // Timeout safety
  setTimeout(() => process.exit(0), 2000);
}, 100);
