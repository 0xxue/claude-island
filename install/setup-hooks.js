#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const BRIDGE_PATH = path.resolve(__dirname, '..', 'bridge', 'bridge.js').replace(/\\/g, '/');

const HOOKS = {
  PreToolUse: [{
    matcher: '',
    hooks: [{ type: 'command', command: `node "${BRIDGE_PATH}" --event tool_start` }],
  }],
  PostToolUse: [{
    matcher: '',
    hooks: [{ type: 'command', command: `node "${BRIDGE_PATH}" --event tool_done` }],
  }],
  PermissionRequest: [{
    matcher: '',
    hooks: [{ type: 'command', command: `node "${BRIDGE_PATH}" --event permission` }],
  }],
  Stop: [{
    matcher: '',
    hooks: [{ type: 'command', command: `node "${BRIDGE_PATH}" --event stop` }],
  }],
  Notification: [{
    matcher: '',
    hooks: [{ type: 'command', command: `node "${BRIDGE_PATH}" --event notification` }],
  }],
  SessionStart: [{
    matcher: '',
    hooks: [{ type: 'command', command: `node "${BRIDGE_PATH}" --event start` }],
  }],
  SessionEnd: [{
    matcher: '',
    hooks: [{ type: 'command', command: `node "${BRIDGE_PATH}" --event end` }],
  }],
};

function setup() {
  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch {
      console.error('Failed to parse settings.json, creating new one');
    }
  }

  if (!settings.hooks) settings.hooks = {};

  // Remove old bridge hooks first (clean reinstall)
  for (const event of Object.keys(settings.hooks)) {
    if (Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = settings.hooks[event].filter(h =>
        !h.hooks?.some(hh => hh.command?.includes('bridge.js'))
      );
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
  }

  // Add fresh hooks
  for (const [event, config] of Object.entries(HOOKS)) {
    if (!settings.hooks[event]) settings.hooks[event] = [];
    settings.hooks[event].push(...config);
    console.log(`+ ${event}`);
  }

  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  console.log(`\nHooks: ${SETTINGS_PATH}`);
  console.log(`Bridge: ${BRIDGE_PATH}`);
}

setup();
