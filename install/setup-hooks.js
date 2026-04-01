#!/usr/bin/env node
/**
 * Auto-configure Claude Code hooks for Claude Island.
 * Adds Stop, PermissionRequest, Notification hooks to ~/.claude/settings.json
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const BRIDGE_PATH = path.resolve(__dirname, '..', 'bridge', 'bridge.js').replace(/\\/g, '/');

const HOOKS = {
  Stop: [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: `node "${BRIDGE_PATH}" --event stop`,
    }],
  }],
  PermissionRequest: [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: `node "${BRIDGE_PATH}" --event permission`,
    }],
  }],
  Notification: [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: `node "${BRIDGE_PATH}" --event notification`,
    }],
  }],
  SessionStart: [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: `node "${BRIDGE_PATH}" --event start`,
    }],
  }],
  SessionEnd: [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: `node "${BRIDGE_PATH}" --event end`,
    }],
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

  // Merge hooks (don't overwrite existing)
  for (const [event, config] of Object.entries(HOOKS)) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = config;
      console.log(`+ Added hook: ${event}`);
    } else {
      // Check if our hook already exists
      const existing = settings.hooks[event];
      const hasOurs = existing.some(h =>
        h.hooks?.some(hh => hh.command?.includes('bridge.js'))
      );
      if (!hasOurs) {
        settings.hooks[event].push(...config);
        console.log(`+ Appended hook: ${event}`);
      } else {
        console.log(`= Hook already exists: ${event}`);
      }
    }
  }

  // Ensure directory exists
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  console.log(`\nHooks configured in: ${SETTINGS_PATH}`);
  console.log(`Bridge path: ${BRIDGE_PATH}`);
  console.log('\nDone! Start Claude Island with: npm start');
}

setup();
