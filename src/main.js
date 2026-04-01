const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { IslandServer } = require('./ws-server');

let win = null;
let tray = null;
const server = new IslandServer();

// Fixed window size — big enough for expanded state. CSS handles visual size transitions.
const WIN_W = 320;
const WIN_H = 160;

function centerX() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  return Math.round(width / 2 - WIN_W / 2);
}

function createIsland() {
  console.log('[Island] Scale:', screen.getPrimaryDisplay().scaleFactor);

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: centerX(),
    y: 8,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'island', 'index.html'));
  win.setAlwaysOnTop(true, 'screen-saver');
  // Forward mouse events — transparent areas click-through, opaque areas capture
  win.setIgnoreMouseEvents(true, { forward: true });

  // Start off-screen
  win.setPosition(-9999, -9999);
}

function showWin() {
  if (!win) return;
  win.setPosition(centerX(), 8);
  win.showInactive();
  win.setAlwaysOnTop(true, 'screen-saver');
}

function hideWin() {
  if (!win) return;
  win.setPosition(-9999, -9999);
}

function isUserInEditor(callback) {
  const { exec } = require('child_process');
  const script = path.join(__dirname, 'check-focus.ps1');
  exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`, (err, stdout) => {
    const name = (stdout || '').trim().toLowerCase();
    const inEditor = name === 'code' || name === 'windowsterminal' || name === 'cmd' || name === 'powershell' || name === 'electron';
    callback(inEditor);
  });
}

function showIsland(event) {
  if (!win) return;
  if (event.type === 'end' || event.type === 'start') {
    hideWin();
    return;
  }

  showWin();

  if (event.type === 'permission') {
    win.webContents.send('claude-event', event);
    win.webContents.send('auto-expand');
    return;
  }

  if (event.type === 'stop') {
    isUserInEditor((inEditor) => {
      if (!inEditor) win.webContents.send('auto-expand');
      win.webContents.send('claude-event', event);
    });
    return;
  }

  win.webContents.send('claude-event', event);
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Claude Island');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Claude Island', enabled: false },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
}

app.whenReady().then(() => {
  createIsland();
  createTray();
  server.start();
  server.on('claude-event', showIsland);
});

const { focusClaude } = require('./window-focus');

ipcMain.on('focus-claude', () => { focusClaude(); });
ipcMain.on('dismiss-island', () => { hideWin(); });
// expand/collapse/dot — all handled by CSS now, no window resize needed
ipcMain.on('expand-island', () => {});
ipcMain.on('collapse-island', () => {});
ipcMain.on('dot-island', () => {});
ipcMain.on('set-clickable', (_, v) => {
  if (!win) return;
  win.setIgnoreMouseEvents(!v, { forward: true });
});

app.on('window-all-closed', (e) => e.preventDefault());
