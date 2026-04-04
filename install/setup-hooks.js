#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ═══ Paths ═══
const BRIDGE_PATH = path.resolve(__dirname, '..', 'bridge-rs', 'target', 'release', 'island-bridge.exe').replace(/\\/g, '/');
const CLAUDE_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const CODEX_CONFIG = path.join(os.homedir(), '.codex', 'config.toml');
const GEMINI_SETTINGS = path.join(os.homedir(), '.gemini', 'settings.json');

// ═══ Hook Configs ═══
function claudeHooks() {
  const b = `"${BRIDGE_PATH}" --agent claude`;
  return {
    PreToolUse: [
      // Single hook: bridge decides whether to wait for approval or fire-and-forget
      { matcher: '', hooks: [{ type: 'command', command: `${b} --event pre_tool`, timeout: 30000 }] },
    ],
    PostToolUse: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event tool_done` }] }],
    Stop: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event stop` }] }],
    Notification: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event notification` }] }],
    SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event start` }] }],
    SessionEnd: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event end` }] }],
  };
}

function codexHooks() {
  const b = `"${BRIDGE_PATH}" --agent codex`;
  return {
    PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event tool_start` }] }],
    PostToolUse: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event tool_done` }] }],
    Stop: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event stop` }] }],
    SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event start` }] }],
  };
}

function geminiHooks() {
  const b = `"${BRIDGE_PATH}" --agent gemini`;
  return {
    BeforeTool: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event BeforeTool` }] }],
    AfterTool: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event AfterTool` }] }],
    SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event SessionStart` }] }],
    SessionEnd: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event SessionEnd` }] }],
    Notification: [{ matcher: '', hooks: [{ type: 'command', command: `${b} --event Notification` }] }],
  };
}

// ═══ Helpers ═══
function commandExists(cmd) {
  try {
    execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function loadJson(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); }
  catch { return {}; }
}

function saveJson(filepath, data) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function removeOldHooks(settings) {
  if (!settings.hooks) return;
  for (const event of Object.keys(settings.hooks)) {
    if (Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = settings.hooks[event].filter(h =>
        !h.hooks?.some(hh => hh.command?.includes('island-bridge') || hh.command?.includes('bridge.js'))
      );
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
  }
}

function installHooks(settings, hooks) {
  if (!settings.hooks) settings.hooks = {};
  for (const [event, config] of Object.entries(hooks)) {
    if (!settings.hooks[event]) settings.hooks[event] = [];
    settings.hooks[event].push(...config);
  }
}

// ═══ Main ═══
function setup() {
  // Check bridge exists
  if (!fs.existsSync(BRIDGE_PATH)) {
    console.error('Bridge not found:', BRIDGE_PATH);
    console.error('Run: cd bridge-rs && cargo build --release');
    process.exit(1);
  }

  console.log('Island Bridge:', BRIDGE_PATH);
  console.log('');

  let installed = 0;

  // Claude Code
  if (commandExists('claude')) {
    console.log('✓ Claude Code detected');
    const settings = loadJson(CLAUDE_SETTINGS);
    removeOldHooks(settings);
    installHooks(settings, claudeHooks());
    saveJson(CLAUDE_SETTINGS, settings);
    console.log('  → ' + CLAUDE_SETTINGS);
    installed++;
  } else {
    console.log('  Claude Code not found, skipping');
  }

  // Codex CLI — hooks disabled on Windows, use notify in config.toml
  if (commandExists('codex')) {
    console.log('✓ Codex CLI detected (Windows: using notify in config.toml)');
    const tomlPath = CODEX_CONFIG;
    let toml = fs.existsSync(tomlPath) ? fs.readFileSync(tomlPath, 'utf8') : '';
    // Remove old notify line
    toml = toml.replace(/^notify\s*=.*$/m, '').replace(/\n{3,}/g, '\n\n');
    // Add notify after first line (or at top)
    const notifyLine = `notify = ["${BRIDGE_PATH}", "--agent", "codex", "--event", "stop"]`;
    const lines = toml.split('\n');
    // Insert after first non-empty line
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) { insertIdx = i + 1; break; }
    }
    lines.splice(insertIdx, 0, notifyLine);
    fs.writeFileSync(tomlPath, lines.join('\n'));
    console.log('  → ' + tomlPath);
    installed++;
  } else {
    console.log('  Codex CLI not found, skipping');
  }

  // Gemini CLI
  if (commandExists('gemini')) {
    console.log('✓ Gemini CLI detected');
    const settings = loadJson(GEMINI_SETTINGS);
    removeOldHooks(settings);
    installHooks(settings, geminiHooks());
    saveJson(GEMINI_SETTINGS, settings);
    console.log('  → ' + GEMINI_SETTINGS);
    installed++;
  } else {
    console.log('  Gemini CLI not found, skipping');
  }

  console.log('');
  console.log(`Done! ${installed} agent(s) configured.`);
}

// ═══ Uninstall ═══
function uninstall() {
  for (const filepath of [CLAUDE_SETTINGS, CODEX_HOOKS, GEMINI_SETTINGS]) {
    if (fs.existsSync(filepath)) {
      const settings = loadJson(filepath);
      removeOldHooks(settings);
      saveJson(filepath, settings);
      console.log('Cleaned:', filepath);
    }
  }
  console.log('All island hooks removed.');
}

if (process.argv.includes('--uninstall')) {
  uninstall();
} else {
  setup();
}
