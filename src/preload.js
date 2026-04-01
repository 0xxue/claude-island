const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  onEvent: (callback) => ipcRenderer.on('claude-event', (_, event) => callback(event)),
  onAutoExpand: (callback) => ipcRenderer.on('auto-expand', () => callback()),
  focusClaudeWindow: () => ipcRenderer.send('focus-claude'),
  dismiss: () => ipcRenderer.send('dismiss-island'),
  expand: () => ipcRenderer.send('expand-island'),
  collapse: () => ipcRenderer.send('collapse-island'),
  toDot: () => ipcRenderer.send('dot-island'),
  setClickable: (v) => ipcRenderer.send('set-clickable', v),
  drag: (dx, dy) => ipcRenderer.send('drag-island', dx, dy),
  recenter: () => ipcRenderer.send('recenter-island'),
});
