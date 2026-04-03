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
    dismiss: function() { invoke('dismiss_island'); },
    show: function() { invoke('show_island'); },
    resizeIsland: function(w, h) {
      try {
        var T = window.__TAURI__;
        if (!T) { console.log('[resize] no TAURI'); return; }
        var win = T.window.getCurrentWindow();
        var LS = T.window.LogicalSize;
        var LP = T.window.LogicalPosition;
        console.log('[resize] calling setSize', w, h, 'win:', !!win, 'LS:', !!LS);
        win.setSize(new LS(w, h)).then(function() {
          console.log('[resize] setSize OK, getting monitor...');
          return win.currentMonitor();
        }).then(function(monitor) {
          if (monitor) {
            var mw = monitor.size.width / monitor.scaleFactor;
            var x = Math.round((mw - w) / 2);
            console.log('[resize] setPosition x=' + x + ' mw=' + Math.round(mw) + ' scale=' + monitor.scaleFactor);
            return win.setPosition(new LP(x, 8));
          }
        }).then(function() {
          console.log('[resize] DONE');
        }).catch(function(e) { console.error('[resize] ERROR:', e); });
      } catch(e) { console.error('[resize] EXCEPTION:', e); }
    },
    recenter: function() { invoke('recenter_window'); },
    getConfig: function() { return invoke('get_config'); },
    saveConfig: function(cfg) { return invoke('save_config', { config: cfg }); },
    getSessions: function() { return invoke('get_sessions'); },
    respondPermission: function(requestId, decision, reason) {
      return invoke('respond_permission', { requestId: requestId, decision: decision, reason: reason || null });
    },
    focusAgent: function(source, terminalType, terminalId) {
      invoke('focus_agent_window', { source: source || 'cli', terminalType: terminalType || null, terminalId: terminalId || null });
    },
    focusClaudeWindow: function(source) {
      invoke('focus_agent_window', { source: source || 'cli', terminalType: null, terminalId: null });
    },
  };
})();
