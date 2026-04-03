// ═══════════════════════════════════════════
// Claude Island — Unified App (Tauri v2)
// Pixel Pet + Sound + Multi-Agent + Themes
// ═══════════════════════════════════════════

var island = document.getElementById('island');
var dragHandle = document.getElementById('drag-handle');
var feed = document.getElementById('notification-feed');
var pillText = document.getElementById('pill-text');
var pillWave = document.getElementById('pill-wave');
var footerStat = document.getElementById('footer-stat');
var expandedContent = document.querySelector('.expanded-content');
var petSpeechEl = document.getElementById('pet-speech');
var agentTabsEl = document.getElementById('agent-tabs');

var pet = new IslandPet('octopus');
var sound = new IslandSound({ volume: 0.3, enabled: true });

var currentPetType = 'octopus';
var HEADER_H = 44;
var MAX_HEIGHT = 520;

// ═══ Agent Config ═══
var AGENT_COLORS = {
  claude: 'var(--claude-color)', codex: 'var(--codex-color)',
  gemini: 'var(--gemini-color)', cursor: 'var(--cursor-color)',
  windsurf: 'var(--windsurf-color)'
};
var AGENT_PETS = {
  claude: 'crab', codex: 'robot', gemini: 'dragon',
  cursor: 'ghost', windsurf: 'fox'
};
var AGENT_LABELS = {
  claude: 'Claude', codex: 'Codex', gemini: 'Gemini',
  cursor: 'Cursor', windsurf: 'Windsurf'
};

// ═══ State ═══
var state = 'circle';
var stateTime = Date.now();
var notifCount = 0;
var pendingAgents = new Set();
var activeFilter = 'all';

// ═══ Pixel Pet ═══
function setPixelPetType(type) {
  currentPetType = type;
  ['circle-pixel-pet', 'pill-pixel-pet', 'exp-pixel-pet'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var isMini = el.classList.contains('mini');
    el.className = 'pixel-pet ' + type + (isMini ? ' mini' : '');
    if (!el.querySelector('.sprite')) {
      var s = document.createElement('div');
      s.className = 'sprite';
      el.appendChild(s);
    }
  });
}

function setPixelPetState(cssState) {
  ['circle-pixel-pet', 'pill-pixel-pet', 'exp-pixel-pet'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('state-working', 'state-alert', 'state-happy', 'state-error');
    if (cssState && cssState !== 'idle') el.classList.add('state-' + cssState);
  });
}

function updatePetState(eventType, toolName) {
  var petState = pet.mapEvent(eventType, toolName);
  pet.setState(petState);
  setPixelPetState(pet.getCssClass());
  document.getElementById('pill-pet-action').textContent = pet.getActionIcon();
  document.getElementById('exp-pet-action').textContent = pet.getActionIcon();
  petSpeechEl.textContent = pet.getSpeech();
  petSpeechEl.style.animation = 'none';
  void petSpeechEl.offsetHeight;
  petSpeechEl.style.animation = 'speech-in 0.3s var(--ease)';
  var zzz = document.getElementById('circle-zzz');
  if (zzz) zzz.style.display = (petState === 'idle' || petState === 'sleeping') ? 'block' : 'none';
}

// ═══ Sound Toggle ═══
var soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  var on = !sound.enabled;
  sound.setEnabled(on);
  soundBtn.textContent = on ? '🔊' : '🔇';
  soundBtn.classList.toggle('muted', !on);
  if (on) sound.play('click');
});

// ═══ Settings Popup ═══
var settingsBtn = document.getElementById('settings-btn');
var settingsPopup = document.getElementById('settings-popup');
var popupOpen = false;

settingsBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  popupOpen = !popupOpen;
  if (popupOpen) {
    // Expand window to fit popup below island
    if (window.islandAPI && window.islandAPI.resizeIsland) window.islandAPI.resizeIsland(460, 500);
    settingsPopup.style.display = 'block';
    var rect = settingsBtn.getBoundingClientRect();
    settingsPopup.style.top = (rect.bottom + 8) + 'px';
    settingsPopup.style.left = Math.max(8, rect.right - settingsPopup.offsetWidth) + 'px';
    settingsPopup.style.transform = 'none';
  } else {
    settingsPopup.style.display = 'none';
    // Restore window to current state size
    var sz = STATE_SIZES[state] || STATE_SIZES.pill;
    if (window.islandAPI && window.islandAPI.resizeIsland) window.islandAPI.resizeIsland(sz[0], sz[1]);
  }
});

document.addEventListener('click', function(e) {
  if (popupOpen && !settingsPopup.contains(e.target) && e.target !== settingsBtn) {
    popupOpen = false;
    settingsPopup.style.display = 'none';
    // Restore window size
    var sz = STATE_SIZES[state] || STATE_SIZES.pill;
    if (window.islandAPI && window.islandAPI.resizeIsland) window.islandAPI.resizeIsland(sz[0], sz[1]);
  }
});

// Pet selector
document.querySelectorAll('.pet-option').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    document.querySelectorAll('.pet-option').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    pet.setType(btn.dataset.pet);
    setPixelPetType(btn.dataset.pet);
    sound.play('click');
  });
});

// Theme selector
document.querySelectorAll('.theme-option').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    document.querySelectorAll('.theme-option').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.documentElement.setAttribute('data-theme', btn.dataset.theme);
    sound.play('click');
  });
});

// Volume slider
document.getElementById('volume-slider').addEventListener('input', function(e) {
  sound.setVolume(parseInt(e.target.value) / 100);
});

// ═══ State Machine ═══
// Window sizes for each state (matches CSS widths/heights exactly)
var STATE_SIZES = { circle: [56, 56], pill: [440, 44], expanded: [460, 400] };

function setState(s) {
  state = s;
  stateTime = Date.now();
  island.classList.remove('island-circle', 'island-pill', 'island-expanded');
  island.classList.add('island-' + s);
  // Resize window to match island state
  var sz = STATE_SIZES[s] || STATE_SIZES.pill;
  if (window.islandAPI && window.islandAPI.resizeIsland) window.islandAPI.resizeIsland(sz[0], sz[1]);
  updateHeight();
}

function updateHeight() {
  if (state === 'expanded') {
    island.style.height = 'auto';
    var h = HEADER_H + expandedContent.scrollHeight;
    h = Math.min(h, MAX_HEIGHT);
    island.style.height = h + 'px';
    // Update window to match actual expanded height
    if (window.islandAPI && window.islandAPI.resizeIsland) window.islandAPI.resizeIsland(460, h);
  } else if (state === 'pill') {
    island.style.height = HEADER_H + 'px';
  } else {
    island.style.height = '56px';
  }
}

new ResizeObserver(function() { if (state === 'expanded') updateHeight(); }).observe(feed);

// ═══ Click ═══
var clickCount = 0, clickTimer = null;

island.addEventListener('click', function(e) {
  if (e.target.closest('.btn') || e.target.closest('.icon-btn') || e.target.closest('.footer-link') || e.target.closest('.pet-option') || e.target.closest('.theme-option') || e.target.closest('.settings-popup') || e.target.closest('.agent-tab') || e.target.closest('.notif-card') || e.target.closest('.notification-feed')) return;
  if (wasDragging) return;
  if (Date.now() - stateTime < 400) return;
  clickCount++;
  if (clickCount === 1) {
    clickTimer = setTimeout(function() {
      sound.play('click');
      if (state === 'circle') setState('pill');
      else if (state === 'pill') setState('expanded');
      else if (state === 'expanded') setState('pill');
      clickCount = 0;
    }, 220);
  } else if (clickCount === 2) {
    clearTimeout(clickTimer);
    clickCount = 0;
    sound.play('click');
    if (state === 'circle') setState('expanded');
    else setState('circle');
  }
});

// ═══ Drag (OS native, only after mouse moves 5px) ═══
var wasDragging = false;
var dragPending = false, dragSX = 0, dragSY = 0;

island.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  if (e.target.closest('.btn') || e.target.closest('.icon-btn') || e.target.closest('.footer-link') || e.target.closest('.settings-popup') || e.target.closest('.agent-tab') || e.target.closest('.action-btn') || e.target.closest('.btn-jump') || e.target.closest('.volume-slider') || e.target.closest('.pet-option') || e.target.closest('.theme-option') || e.target.closest('.notification-feed')) return;
  dragPending = true;
  dragSX = e.screenX;
  dragSY = e.screenY;
});

document.addEventListener('mousemove', function(e) {
  if (!dragPending) return;
  var dx = Math.abs(e.screenX - dragSX);
  var dy = Math.abs(e.screenY - dragSY);
  if (dx > 5 || dy > 5) {
    dragPending = false;
    wasDragging = true;
    if (window.__TAURI__) {
      window.__TAURI__.window.getCurrentWindow().startDragging();
    }
    setTimeout(function() { wasDragging = false; }, 300);
  }
});

document.addEventListener('mouseup', function() {
  dragPending = false;
});

// ═══ Pill Status ═══
var lastPillEvent = '';

function updatePillStatus(eventType, agent, tool, detail) {
  var sessionCount = Object.keys(sessionCards).length;

  if (eventType) {
    // Show latest event info in pill
    var agentLabel = AGENT_LABELS[agent] || agent || '';
    if (eventType === 'tool_start') {
      lastPillEvent = agentLabel + ' · ' + (tool || 'working') + '...';
      pillWave.className = 'pill-wave active';
    } else if (eventType === 'tool_done') {
      lastPillEvent = agentLabel + ' · ' + (tool || 'done') + ' ✓';
      pillWave.className = 'pill-wave active';
    } else if (eventType === 'stop') {
      lastPillEvent = agentLabel + ' · waiting for input';
      pillWave.className = 'pill-wave active';
    } else if (eventType === 'permission') {
      lastPillEvent = '<span class="highlight">🔐 ' + agentLabel + ' needs approval</span>';
      pillWave.className = 'pill-wave active';
    } else {
      lastPillEvent = agentLabel + ' · ' + eventType;
      pillWave.className = 'pill-wave active';
    }
  }

  if (sessionCount === 0) {
    pillText.innerHTML = 'All Systems Operational';
    pillWave.className = 'pill-wave';
  } else if (pendingAgents.size > 0) {
    pillText.innerHTML = '<span class="highlight">' + notifCount + ' Pending</span> · ' + lastPillEvent;
  } else {
    pillText.innerHTML = lastPillEvent || (sessionCount + ' session(s) active');
  }

  footerStat.textContent = sessionCount + ' session(s)' + (pendingAgents.size > 0 ? ' · ' + pendingAgents.size + ' pending' : '');
}

// ═══ Agent Tabs ═══
function updateAgentTabs() {
  var agents = new Set();
  feed.querySelectorAll('.notif-card').forEach(function(c) { agents.add(c.dataset.agent); });

  agentTabsEl.innerHTML = '<button class="agent-tab' + (activeFilter === 'all' ? ' active' : '') + '" data-filter="all">All</button>';
  agents.forEach(function(agent) {
    var label = AGENT_LABELS[agent] || agent;
    agentTabsEl.innerHTML += '<button class="agent-tab' + (activeFilter === agent ? ' active' : '') + '" data-filter="' + agent + '">' + label + '</button>';
  });

  agentTabsEl.querySelectorAll('.agent-tab').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      activeFilter = btn.dataset.filter;
      agentTabsEl.querySelectorAll('.agent-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      filterNotifications();
      sound.play('click');
    });
  });
}

function filterNotifications() {
  feed.querySelectorAll('.notif-card').forEach(function(card) {
    card.style.display = (activeFilter === 'all' || card.dataset.agent === activeFilter) ? '' : 'none';
  });
}

// ═══ Notifications (per-session persistent cards) ═══
var sessionCards = {}; // sessionId → card element

function createNotification(data) {
  var agent = data.agent || 'claude';
  var sessionId = data.sessionId || data.session_id || agent;
  var eventType = data.event_type || data.type || 'tool_start';
  var tool = data.tool || '';
  var needsAction = (eventType === 'permission');

  if (needsAction) pendingAgents.add(agent);
  updatePetState(eventType, tool);
  sound.playForEvent(eventType);
  updatePillStatus(eventType, agent, tool);
  if (state === 'circle') setState('pill');

  // Auto-expand on important events
  if ((needsAction || eventType === 'stop') && state !== 'expanded') {
    setState('expanded');
  }

  var agentLabel = AGENT_LABELS[agent] || agent;
  var agentPet = AGENT_PETS[agent] || 'octopus';

  // Build status text
  var statusText = '';
  var statusIcon = '';
  if (eventType === 'tool_start') {
    statusIcon = '⚡';
    statusText = (tool || 'Working') + '...';
    if (data.file) statusText += ' ' + shortPath(data.file);
    else if (data.command) statusText += ' $ ' + data.command;
  } else if (eventType === 'tool_done') {
    statusIcon = '✓';
    statusText = (tool || 'Task') + ' done';
    if (data.file) statusText += ' ' + shortPath(data.file);
  } else if (eventType === 'permission') {
    statusIcon = '🔐';
    statusText = 'Needs approval: ' + (tool || 'tool');
    if (data.file) statusText += ' on ' + shortPath(data.file);
  } else if (eventType === 'stop') {
    statusIcon = '💬';
    statusText = data.message || 'Waiting for input...';
  } else if (eventType === 'notification') {
    statusIcon = '📢';
    statusText = data.message || data.title || 'Notification';
  } else {
    statusIcon = '•';
    statusText = eventType;
  }

  // Existing card? Update it
  var card = sessionCards[sessionId];
  if (card && feed.contains(card)) {
    // Update status line
    var bodyEl = card.querySelector('.notif-body');
    if (bodyEl) bodyEl.innerHTML = '<span class="status-icon">' + statusIcon + '</span> ' + statusText;

    // Update badge
    var badge = card.querySelector('.action-badge');
    if (badge) {
      if (needsAction) {
        var actionType = tool === 'Bash' ? 'execute' : tool === 'Write' ? 'write' : 'modify';
        badge.className = 'action-badge ' + actionType;
        badge.textContent = actionType.charAt(0).toUpperCase() + actionType.slice(1);
      } else {
        badge.className = 'action-badge info';
        badge.textContent = eventType === 'tool_done' ? 'Done' : eventType === 'stop' ? 'Waiting' : 'Active';
      }
    }

    // Add/remove action buttons for permission
    var actionsEl = card.querySelector('.notif-actions');
    if (needsAction && !actionsEl) {
      actionsEl = document.createElement('div');
      actionsEl.className = 'notif-actions';
      actionsEl.innerHTML = '<button class="btn btn-deny action-btn" data-action="deny">Deny</button><button class="btn btn-once action-btn" data-action="allow">Allow Once</button><button class="btn btn-all action-btn" data-action="allow_all">Allow All</button><button class="btn btn-bypass action-btn" data-action="bypass">Bypass</button>';
      card.appendChild(actionsEl);
      bindActionButtons(card, agent, data);
      notifCount++;
      updatePillStatus();
    } else if (!needsAction && actionsEl) {
      actionsEl.remove();
    }

    // Code preview
    var codeEl = card.querySelector('.notif-code');
    if (data.code && !codeEl) {
      var codeHtml = '<div class="notif-code"><div class="code-header"><span class="code-filename">' + (data.code.file || '') + '</span>';
      if (data.code.tag) codeHtml += '<span class="code-tag">' + data.code.tag + '</span>';
      codeHtml += '</div><div class="code-body">';
      if (data.code.lines) data.code.lines.forEach(function(l) { codeHtml += '<div class="code-line ' + (l.type || 'normal') + '">' + (l.text || l) + '</div>'; });
      codeHtml += '</div></div>';
      var temp = document.createElement('div');
      temp.innerHTML = codeHtml;
      var bodyNext = card.querySelector('.notif-body');
      if (bodyNext) bodyNext.after(temp.firstChild);
    } else if (!data.code && codeEl) {
      codeEl.remove();
    }

    if (state === 'expanded') updateHeight();
    if (needsAction && state !== 'expanded') setState('expanded');
    return;
  }

  // New card
  card = document.createElement('div');
  card.className = 'notif-card';
  card.dataset.agent = agent;
  card.dataset.session = sessionId;

  var h = '<div class="notif-header">';
  h += '<span class="agent-badge"><span class="agent-pet-icon"><div class="pixel-pet ' + agentPet + ' tiny"><div class="sprite"></div></div></span> ' + agentLabel + '</span>';

  if (needsAction) {
    var actionType = tool === 'Bash' ? 'execute' : tool === 'Write' ? 'write' : 'modify';
    h += '<span class="action-badge ' + actionType + '">' + actionType.charAt(0).toUpperCase() + actionType.slice(1) + '</span>';
  } else {
    h += '<span class="action-badge info">Active</span>';
  }

  h += '<button class="btn-jump jump-btn" title="Jump to ' + agentLabel + '">Jump ↗</button>';
  h += '</div>';
  h += '<div class="notif-body"><span class="status-icon">' + statusIcon + '</span> ' + statusText + '</div>';

  // Code preview
  if (data.code) {
    h += '<div class="notif-code"><div class="code-header"><span class="code-filename">' + (data.code.file || '') + '</span>';
    if (data.code.tag) h += '<span class="code-tag">' + data.code.tag + '</span>';
    h += '</div><div class="code-body">';
    if (data.code.lines) data.code.lines.forEach(function(l) { h += '<div class="code-line ' + (l.type || 'normal') + '">' + (l.text || l) + '</div>'; });
    h += '</div></div>';
  }

  // Action buttons for permission
  if (needsAction) {
    h += '<div class="notif-actions">';
    h += '<button class="btn btn-deny action-btn" data-action="deny">Deny</button>';
    h += '<button class="btn btn-once action-btn" data-action="allow">Allow Once</button>';
    h += '<button class="btn btn-all action-btn" data-action="allow_all">Allow All</button>';
    h += '<button class="btn btn-bypass action-btn" data-action="bypass">Bypass</button>';
    h += '</div>';
    notifCount++;
  }

  card.innerHTML = h;
  feed.insertBefore(card, feed.firstChild);
  sessionCards[sessionId] = card;

  // Bind Jump button
  card.querySelector('.jump-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    sound.play('click');
    if (window.islandAPI && window.islandAPI.focusAgent) {
      window.islandAPI.focusAgent(
        data.source || 'cli',
        data.terminal ? data.terminal.type : null,
        data.terminal ? (data.terminal.id || String(data.terminal.pid || '')) : null
      );
    }
  });

  // Bind action buttons
  if (needsAction) bindActionButtons(card, agent, data);

  updatePillStatus();
  updateAgentTabs();
  filterNotifications();
  if (state === 'expanded') updateHeight();
  if (needsAction && state !== 'expanded') setState('expanded');
}

function bindActionButtons(card, agent, data) {
  card.querySelectorAll('.action-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      sound.play('complete');
      updatePetState('complete');
      if (window.islandAPI && window.islandAPI.respondPermission && data.requestId) {
        window.islandAPI.respondPermission(data.requestId, btn.dataset.action);
      }
      // Remove action buttons after approval
      var actionsEl = card.querySelector('.notif-actions');
      if (actionsEl) actionsEl.remove();
      notifCount--;
      var badge = card.querySelector('.action-badge');
      if (badge) { badge.className = 'action-badge info'; badge.textContent = 'Done'; }
      pendingAgents.delete(agent);
      updatePillStatus();
      if (state === 'expanded') updateHeight();
    });
  });
}

function shortPath(p) {
  if (!p) return '';
  var s = p.replace(/\\/g, '/').split('/');
  return s.length > 2 ? '.../' + s.slice(-2).join('/') : p;
}

// ═══ Event Listener (from Tauri/bridge) ═══
if (window.islandAPI && window.islandAPI.onEvent) {
  window.islandAPI.onEvent(function(event) {
    var e = Object.assign({}, event);
    if (!e.type && e.event_type) e.type = e.event_type;
    if (!e.event_type && e.type) e.event_type = e.type;

    if (e.event_type === 'start' || e.event_type === 'end') return;

    createNotification(e);
  });
}

// ═══ Init ═══
setPixelPetType('octopus');
updatePetState('sleeping');
