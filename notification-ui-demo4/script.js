// ═══════════════════════════════════════════
// Claude Island — Glass + Pixel Pet + Sound
// ═══════════════════════════════════════════

var island = document.getElementById('island');
var dragHandle = document.getElementById('drag-handle');
var feed = document.getElementById('notification-feed');
var pillText = document.getElementById('pill-text');
var pillWave = document.getElementById('pill-wave');
var footerStat = document.getElementById('footer-stat');
var expandedContent = document.querySelector('.expanded-content');
var petSpeechEl = document.getElementById('pet-speech');

var pet = new IslandPet('octopus');
var sound = new IslandSound({ volume: 0.3, enabled: true });

var currentPetType = 'octopus';
var HEADER_H = 44;
var MAX_HEIGHT = 520;

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
  zzz.style.display = (petState === 'idle' || petState === 'sleeping') ? 'block' : 'none';
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
  settingsPopup.style.display = popupOpen ? 'block' : 'none';
});

document.addEventListener('click', function(e) {
  if (popupOpen && !settingsPopup.contains(e.target) && e.target !== settingsBtn) {
    popupOpen = false;
    settingsPopup.style.display = 'none';
  }
});

// ═══ Pet Selector (inside popup) ═══
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

// ═══ State Machine ═══
var state = 'circle';
var stateTime = Date.now();

function setState(s) {
  state = s;
  stateTime = Date.now();
  island.classList.remove('island-circle', 'island-pill', 'island-expanded');
  island.classList.add('island-' + s);
  updateHeight();
}

function updateHeight() {
  if (state === 'expanded') {
    island.style.height = 'auto';
    var h = HEADER_H + expandedContent.scrollHeight;
    island.style.height = Math.min(h, MAX_HEIGHT) + 'px';
  } else if (state === 'pill') {
    island.style.height = HEADER_H + 'px';
  } else {
    island.style.height = '56px';
  }
}

new ResizeObserver(function() { if (state === 'expanded') updateHeight(); }).observe(feed);

// ═══ Click ═══
var clickCount = 0, clickTimer = null, wasDragging = false;

island.addEventListener('click', function(e) {
  if (e.target.closest('.btn') || e.target.closest('.footer-link') || e.target.closest('.pet-option')) return;
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

// ═══ Drag ═══
var isDragging = false, offX = 0, offY = 0, initDX = 0, initDY = 0;

dragHandle.addEventListener('mousedown', function(e) {
  if (e.target.closest('.btn') || e.target.closest('.footer-link')) return;
  isDragging = true;
  wasDragging = false;
  initDX = e.clientX - offX;
  initDY = e.clientY - offY;
  island.style.transition = 'border-radius 0.45s, width 0.45s, background 0.45s, border-color 0.45s, box-shadow 0.45s';
});

document.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  e.preventDefault();
  var dx = e.clientX - initDX, dy = e.clientY - initDY;
  if (Math.abs(dx - offX) > 3 || Math.abs(dy - offY) > 3) wasDragging = true;
  offX = dx; offY = dy;
  island.style.transform = 'translate(calc(-50% + ' + offX + 'px), ' + offY + 'px)';
});

document.addEventListener('mouseup', function() {
  if (isDragging) { isDragging = false; island.style.transition = ''; setTimeout(function() { wasDragging = false; }, 50); }
});

// ═══ Notifications ═══
var notifCount = 0, pendingAgents = new Set();
var AGENT_COLORS = { Claude: 'var(--claude-color)', Codex: 'var(--codex-color)', Gemini: 'var(--gemini-color)', Cursor: 'var(--cursor-color)' };
var AGENT_PETS = { Claude: 'crab', Codex: 'robot', Gemini: 'dragon', Cursor: 'ghost' };

var mockMessages = [
  { agent: 'Claude', text: 'Requests to patch routing middleware.<br><span class="user-msg">You: Fix the CORS headers</span>', actionType: 'modify', eventType: 'permission', tool: 'Edit', code: { file: 'api.js', tag: 'diff', lines: [{ type: 'del', text: '- res.header("Access-Control-Allow-Origin", "*");' }, { type: 'add', text: '+ res.header("Access-Control-Allow-Origin", "https://app.example.com");' }] }, needsAction: true },
  { agent: 'Gemini', text: 'Database indexing completed. Queries 40% faster.', actionType: 'info', eventType: 'tool_done', tool: 'Bash', code: null, needsAction: false },
  { agent: 'Codex', text: 'Needs approval to execute migration.', actionType: 'execute', eventType: 'permission', tool: 'Bash', code: { file: 'terminal', tag: 'bash', lines: [{ type: 'normal', text: 'npm run db:migrate -- --force' }] }, needsAction: true },
  { agent: 'Claude', text: 'Optimizing webpack config.<br><span class="user-msg">You: Make bundle smaller</span>', actionType: 'write', eventType: 'permission', tool: 'Write', code: { file: 'webpack.config.js', tag: '', lines: [{ type: 'normal', text: '  optimization: {' }, { type: 'add', text: '+   minimize: true,' }, { type: 'add', text: '+   splitChunks: { chunks: "all" },' }, { type: 'normal', text: '  }' }] }, needsAction: true },
  { agent: 'Cursor', text: 'Auto-completed 12 functions in Dashboard.tsx', actionType: 'info', eventType: 'tool_done', tool: 'Edit', code: null, needsAction: false },
];

function updatePillStatus() {
  if (pendingAgents.size === 0) {
    pillText.innerHTML = 'All Systems Operational';
    pillWave.className = 'pill-wave';
    updatePetState('idle');
  } else {
    pillText.innerHTML = '<span class="highlight">' + notifCount + ' Pending</span> · ' + Array.from(pendingAgents).join(', ');
    pillWave.className = 'pill-wave active';
  }
  footerStat.textContent = pendingAgents.size + ' agents active';
}

function createNotification(data) {
  if (data.needsAction) pendingAgents.add(data.agent);
  updatePetState(data.eventType, data.tool);
  sound.playForEvent(data.eventType);
  if (state === 'circle') setState('pill');

  var card = document.createElement('div');
  card.className = 'notif-card';
  card.dataset.agent = data.agent;
  var color = AGENT_COLORS[data.agent] || 'var(--accent)';
  var agentPet = AGENT_PETS[data.agent] || 'octopus';
  var h = '<div class="notif-header"><span class="agent-badge"><span class="agent-pet-icon"><div class="pixel-pet ' + agentPet + ' tiny"><div class="sprite"></div></div></span> ' + data.agent + '</span>';
  if (data.actionType) h += '<span class="action-badge ' + data.actionType + '">' + data.actionType.charAt(0).toUpperCase() + data.actionType.slice(1) + '</span>';
  h += '<button class="btn-jump jump-btn" title="Jump to ' + data.agent + '">↗</button>';
  h += '</div><div class="notif-body">' + data.text + '</div>';
  if (data.code) {
    h += '<div class="notif-code"><div class="code-header"><span class="code-filename">' + data.code.file + '</span>';
    if (data.code.tag) h += '<span class="code-tag">' + data.code.tag + '</span>';
    h += '</div><div class="code-body">';
    data.code.lines.forEach(function(l) { h += '<div class="code-line ' + l.type + '">' + l.text + '</div>'; });
    h += '</div></div>';
  }
  if (data.needsAction) {
    h += '<div class="notif-actions"><button class="btn btn-deny action-btn">Deny</button><button class="btn btn-once action-btn">Allow Once</button><button class="btn btn-all action-btn">Allow All</button><button class="btn btn-bypass action-btn">Bypass</button></div>';
    notifCount++;
  }
  card.innerHTML = h;
  feed.insertBefore(card, feed.firstChild);
  updatePillStatus();
  if (state === 'expanded') updateHeight();

  // Jump button
  card.querySelector('.jump-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    sound.play('click');
    alert('Jump to ' + data.agent + ' terminal');  // In real app: window.island.focusClaudeWindow()
  });

  if (data.needsAction) {
    card.querySelectorAll('.action-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        sound.play('complete');
        updatePetState('complete');
        btn.textContent = '✓';
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        setTimeout(function() { removeCard(card, data.agent); }, 600);
      });
    });
  } else {
    setTimeout(function() { removeCard(card, data.agent, true); }, 8000);
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
    feed.querySelectorAll('.notif-card').forEach(function(c) { if (c.dataset.agent === agent && c.querySelector('.action-btn')) still = true; });
    if (!still) pendingAgents.delete(agent);
    updatePillStatus();
    if (state === 'expanded') updateHeight();
  }, 300);
}

// ═══ Init ═══
setPixelPetType('octopus');
updatePetState('sleeping');
setTimeout(function() { createNotification(mockMessages[0]); }, 1000);
setTimeout(function() { createNotification(mockMessages[1]); }, 3000);
setTimeout(function() { createNotification(mockMessages[2]); }, 6000);
var mi = 3;
setInterval(function() { createNotification(mockMessages[mi]); mi = (mi + 1) % mockMessages.length; }, 9000);
