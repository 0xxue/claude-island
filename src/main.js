const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { IslandServer } = require('./ws-server');

let win = null;
let tray = null;
const server = new IslandServer();

const COLLAPSED = { w: 220, h: 30 };
const EXPANDED = { w: 240, h: 110 };

function createIsland() {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  console.log('[Island] Scale:', display.scaleFactor);

  win = new BrowserWindow({
    width: COLLAPSED.w,
    height: COLLAPSED.h,
    x: Math.round(width / 2 - COLLAPSED.w / 2),
    y: 4,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMinimumSize(50, 20);
  win.loadFile(path.join(__dirname, 'island', 'index.html'));
  win.setAlwaysOnTop(true, 'screen-saver');
  win.hide();
}

function setCollapsed() {
  if (!win) return;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win.setBounds({
    x: Math.round(width / 2 - COLLAPSED.w / 2),
    y: 4,
    width: COLLAPSED.w,
    height: COLLAPSED.h,
  });
}

function setExpanded() {
  if (!win) return;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win.setBounds({
    x: Math.round(width / 2 - EXPANDED.w / 2),
    y: 4,
    width: EXPANDED.w,
    height: EXPANDED.h,
  });
}

function showIsland(event) {
  if (!win) return;
  // SessionEnd or SessionStart = user is active, hide island
  if (event.type === 'end' || event.type === 'start') {
    win.setPosition(-9999, -9999);
    return;
  }
  setCollapsed();
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.webContents.send('claude-event', event);
  console.log('[Island] Show:', event.type);
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

// IPC
const { focusClaude } = require('./window-focus');

ipcMain.on('focus-claude', () => {
  focusClaude();
  // Don't hide — island stays until next event or user dismisses
});

ipcMain.on('dismiss-island', () => {
  // Move off screen instead of hide (transparent window can't show again after hide)
  if (!win) return;
  win.setPosition(-9999, -9999);
});

ipcMain.on('expand-island', () => {
  console.log('[Island] IPC: expand');
  setExpanded();
});

ipcMain.on('collapse-island', () => {
  console.log('[Island] IPC: collapse');
  setCollapsed();
});

app.on('window-all-closed', (e) => e.preventDefault());
