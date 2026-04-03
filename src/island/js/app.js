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
function updatePillStatus() {
  if (pendingAgents.size === 0) {
    pillText.innerHTML = 'All Systems Operational';
    pillWave.className = 'pill-wave';
    updatePetState('idle');
  } else {
    var names = Array.from(pendingAgents).map(function(a) { return AGENT_LABELS[a] || a; });
    pillText.innerHTML = '<span class="highlight">' + notifCount + ' Pending</span> · ' + names.join(', ');
    pillWave.className = 'pill-wave active';
  }
  footerStat.textContent = pendingAgents.size + ' agents active';
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

// ═══ Notifications ═══
function createNotification(data) {
  var agent = data.agent || 'claude';
  var eventType = data.event_type || data.type || 'tool_start';
  var tool = data.tool || '';
  var needsAction = (eventType === 'permission');

  if (needsAction) pendingAgents.add(agent);
  updatePetState(eventType, tool);
  sound.playForEvent(eventType);
  if (state === 'circle') setState('pill');

  var card = document.createElement('div');
  card.className = 'notif-card';
  card.dataset.agent = agent;

  var agentLabel = AGENT_LABELS[agent] || agent;
  var agentPet = AGENT_PETS[agent] || 'octopus';

  var h = '<div class="notif-header">';
  h += '<span class="agent-badge"><span class="agent-pet-icon"><div class="pixel-pet ' + agentPet + ' tiny"><div class="sprite"></div></div></span> ' + agentLabel + '</span>';

  if (eventType === 'permission') {
    var actionType = tool === 'Bash' ? 'execute' : tool === 'Write' ? 'write' : 'modify';
    h += '<span class="action-badge ' + actionType + '">' + actionType.charAt(0).toUpperCase() + actionType.slice(1) + '</span>';
  } else {
    h += '<span class="action-badge info">Info</span>';
  }

  h += '<button class="btn-jump jump-btn" title="Jump to ' + agentLabel + '">Jump ↗</button>';
  h += '</div>';

  var bodyText = '';
  if (eventType === 'permission') {
    bodyText = 'Requests approval to use <strong>' + (tool || 'tool') + '</strong>';
    if (data.file) bodyText += ' on <code>' + shortPath(data.file) + '</code>';
  } else if (eventType === 'tool_start') {
    bodyText = (tool || 'Working') + '...';
    if (data.file) bodyText += ' <code>' + shortPath(data.file) + '</code>';
    else if (data.command) bodyText += ' <code>$ ' + data.command + '</code>';
  } else if (eventType === 'tool_done') {
    bodyText = (tool || 'Task') + ' completed ✓';
    if (data.file) bodyText += ' <code>' + shortPath(data.file) + '</code>';
  } else if (eventType === 'stop') {
    bodyText = data.message || 'Waiting for your input...';
  } else {
    bodyText = data.message || data.title || eventType;
  }
  h += '<div class="notif-body">' + bodyText + '</div>';

  if (data.code) {
    h += '<div class="notif-code"><div class="code-header"><span class="code-filename">' + (data.code.file || '') + '</span>';
    if (data.code.tag) h += '<span class="code-tag">' + data.code.tag + '</span>';
    h += '</div><div class="code-body">';
    if (data.code.lines) {
      data.code.lines.forEach(function(l) {
        var type = l.type || 'normal';
        var text = l.text || l;
        h += '<div class="code-line ' + type + '">' + text + '</div>';
      });
    }
    h += '</div></div>';
  }

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
  updatePillStatus();
  updateAgentTabs();
  filterNotifications();
  if (state === 'expanded') updateHeight();

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

  if (needsAction) {
    card.querySelectorAll('.action-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        sound.play('complete');
        updatePetState('complete');
        var decision = btn.dataset.action;
        if (window.islandAPI && window.islandAPI.respondPermission && data.requestId) {
          window.islandAPI.respondPermission(data.requestId, decision);
        }
        btn.textContent = '✓';
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        setTimeout(function() { removeCard(card, agent); }, 600);
      });
    });
  } else {
    setTimeout(function() { removeCard(card, agent, true); }, 8000);
  }

  if (needsAction && state !== 'expanded') {
    setState('expanded');
  }
}

function removeCard(card, agent, isInfo) {
  if (!feed.contains(card)) return;
  card.style.height = card.offsetHeight + 'px';
  void card.offsetHeight;
  card.classList.add('card-out');
  setTimeout(function() {
    if (!feed.contains(card)) return;
    card.remove();
    if (!isInfo) notifCount--;
    var still = false;
    feed.querySelectorAll('.notif-card').forEach(function(c) {
      if (c.dataset.agent === agent && c.querySelector('.action-btn')) still = true;
    });
    if (!still) pendingAgents.delete(agent);
    updatePillStatus();
    updateAgentTabs();
    if (state === 'expanded') updateHeight();
  }, 300);
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
