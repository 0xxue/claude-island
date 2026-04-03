// bridge.js — Tauri v2 API adapter
(function() {
  var invoke, listen;

  if (window.__TAURI__ && window.__TAURI__.core) {
    invoke = window.__TAURI__.core.invoke;
    listen = window.__TAURI__.event.listen;
    console.log('[bridge] Tauri API connected');
  } else {
    invoke = function(cmd, args) {
      console.log('[bridge mock] invoke:', cmd, args);
      return Promise.resolve(null);
    };
    listen = function(event, cb) {
      console.log('[bridge mock] listen:', event);
      return Promise.resolve(function() {});
    };
  }

  window.islandAPI = {
    onEvent: function(cb) { listen('claude-event', function(e) { cb(e.payload); }); },
    onAutoExpand: function(cb) { listen('auto-expand', function(e) { cb(e.payload); }); },
    drag: function(dx, dy) { invoke('drag_window', { dx: Math.round(dx), dy: Math.round(dy) }); },
    dismiss: function() { invoke('dismiss_island'); },
    show: function() { invoke('show_island'); },
    resizeIsland: function(w, h) {
      // Use Rust command — sets position + size synchronously in one call
      invoke('resize_island', { w: w, h: h });
    },
    recenter: function() { invoke('recenter_window'); },
    getConfig: function() { return invoke('get_config'); },
    saveConfig: function(cfg) { return invoke('save_config', { config: cfg }); },
    getSessions: function() { return invoke('get_sessions'); },
    respondPermission: function(requestId, decision, reason) {
      return invoke('respond_permission', { requestId: requestId, decision: decision, reason: reason || null });
    },
    focusAgent: function(source, terminalType, terminalId, cwd) {
      invoke('focus_agent_window', { source: source || 'cli', terminalType: terminalType || null, terminalId: terminalId || null, cwd: cwd || null });
    },
    focusClaudeWindow: function(source) {
      invoke('focus_agent_window', { source: source || 'cli', terminalType: null, terminalId: null });
    },
  };
})();
