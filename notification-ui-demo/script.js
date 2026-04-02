// ═══════════════════════════════════════════
// Demo 1 + Pet + Sound (merged from Demo 4)
// ═══════════════════════════════════════════

var dynamicIsland = document.getElementById('dynamic-island');
var dragHandle = document.getElementById('drag-handle');
var feed = document.getElementById('notification-feed');
var compactStatus = document.getElementById('compact-status');
var expandedContent = document.querySelector('.island-expanded-content');
var petSpeechEl = document.getElementById('pet-speech');

var pet = new IslandPet('octopus');
var sound = new IslandSound({ volume: 0.3, enabled: true });

var MAX_EXPANDED_HEIGHT = 560;
var HEADER_HEIGHT = 44;
var currentState = 'circle';
var AGENT_PETS = { Claude: 'crab', Codex: 'robot', Gemini: 'dragon', Cursor: 'ghost' };

// ═══ Pixel Pet ═══
function setPixelPetType(type) {
  ['circle-pixel-pet', 'pill-pixel-pet', 'exp-pixel-pet'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var isMini = el.classList.contains('mini');
    el.className = 'pixel-pet ' + type + (isMini ? ' mini' : '');
    if (!el.querySelector('.sprite')) {
      var s = document.createElement('div'); s.className = 'sprite'; el.appendChild(s);
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

function updatePetForEvent(eventType, toolName) {
  var petState = pet.mapEvent(eventType, toolName);
  pet.setState(petState);
  setPixelPetState(pet.getCssClass());
  document.getElementById('pill-action').textContent = pet.getActionIcon();
  document.getElementById('exp-action').textContent = pet.getActionIcon();
  petSpeechEl.textContent = pet.getSpeech();
  petSpeechEl.style.animation = 'none';
  void petSpeechEl.offsetHeight;
  petSpeechEl.style.animation = 'speechIn 0.3s var(--transition-snappy)';
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

// Close popup when clicking outside
document.addEventListener('click', function(e) {
  if (popupOpen && !settingsPopup.contains(e.target) && e.target !== settingsBtn) {
    popupOpen = false;
    settingsPopup.style.display = 'none';
  }
});

// ═══ Pet Selector ═══
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

// ═══ Drag ═══
var isDragging = false, wasDragging = false;
var xOffset = 0, yOffset = 0, initialX, initialY, currentX, currentY;

dragHandle.addEventListener('mousedown', function(e) {
  if (e.target.closest('.btn') || e.target.closest('.sound-toggle') || e.target.closest('.settings-btn') || e.target.closest('.footer-link') || e.target.closest('.settings-popup')) return;
  initialX = e.clientX - xOffset;
  initialY = e.clientY - yOffset;
  if (e.target === dragHandle || dragHandle.contains(e.target)) {
    isDragging = true;
    wasDragging = false;
  }
});

document.addEventListener('mouseup', function() {
  initialX = currentX;
  initialY = currentY;
  setTimeout(function() { if (!isDragging) wasDragging = false; }, 50);
  isDragging = false;
});

document.addEventListener('mousemove', function(e) {
  if (isDragging) {
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    xOffset = currentX;
    yOffset = currentY;
    if (Math.abs(currentX) > 3 || Math.abs(currentY) > 3) wasDragging = true;
    dynamicIsland.style.transform = 'translate(calc(-50% + ' + currentX + 'px), ' + currentY + 'px)';
  }
});

// ═══ State ═══
function updateIslandHeight() {
  if (currentState === 'expanded') {
    dynamicIsland.style.height = 'auto';
    var h = HEADER_HEIGHT + expandedContent.scrollHeight;
    if (h > MAX_EXPANDED_HEIGHT) h = MAX_EXPANDED_HEIGHT;
    dynamicIsland.style.height = h + 'px';
  } else {
    dynamicIsland.style.height = currentState === 'circle' ? '60px' : '44px';
  }
}

function setIslandState(newState) {
  currentState = newState;
  dynamicIsland.classList.remove('island-circle', 'island-pill', 'island-expanded');
  dynamicIsland.classList.add('island-' + newState);
  updateIslandHeight();
}

new ResizeObserver(function() { if (currentState === 'expanded') updateIslandHeight(); }).observe(feed);

// ═══ Click ═══
var clickTimeout, clickCount = 0;

dragHandle.addEventListener('click', function(e) {
  if (wasDragging) return;
  if (e.target.closest('.btn') || e.target.closest('.sound-toggle') || e.target.closest('.settings-btn') || e.target.closest('.footer-link') || e.target.closest('.pet-option') || e.target.closest('.settings-popup')) return;
  clickCount++;
  if (clickCount === 1) {
    clickTimeout = setTimeout(function() {
      sound.play('click');
      if (currentState === 'circle') setIslandState('pill');
      else if (currentState === 'pill') setIslandState('expanded');
      else if (currentState === 'expanded') setIslandState('pill');
      clickCount = 0;
    }, 220);
  } else if (clickCount === 2) {
    clearTimeout(clickTimeout);
    sound.play('click');
    if (currentState === 'circle') setIslandState('expanded');
    else setIslandState('circle');
    clickCount = 0;
  }
});

// ═══ Notifications ═══
var notifCount = 0;
var activePendingAgents = new Set();

var mockMessages = [
  { agent: 'Claude', text: 'Requests to patch routing middleware.<br><span style="color:#8b8d96">You: Fix the CORS headers</span>', actionType: 'Modify', eventType: 'permission', tool: 'Edit',
    code: { filename: 'api.js', tag: 'diff', lines: ['- res.header("Access-Control-Allow-Origin", "*");', '+ res.header("Access-Control-Allow-Origin", "https://app.example.com");'] }, action: true },
  { agent: 'Gemini', text: 'Database indexing completed. Query speeds improved by 40%.', actionType: 'Process', eventType: 'tool_done', tool: 'Bash', code: null, action: false },
  { agent: 'Codex', text: 'Needs approval to execute database migration.', actionType: 'Execute', eventType: 'permission', tool: 'Bash',
    code: { filename: 'terminal', tag: 'bash', lines: ['npm run db:migrate -- --force'] }, action: true },
  { agent: 'Claude', text: 'Optimizing webpack config.<br><span style="color:#8b8d96">You: Make bundle smaller</span>', actionType: 'Settings', eventType: 'permission', tool: 'Write',
    code: { filename: 'webpack.config.js', tag: '', lines: ['  optimization: {', '    minimize: true,', '  }'] }, action: true },
  { agent: 'Cursor', text: 'Auto-completed 12 functions in Dashboard.tsx', actionType: 'Info', eventType: 'tool_done', tool: 'Edit', code: null, action: false },
];

function updateCompactStatusDisplay() {
  if (activePendingAgents.size === 0) {
    compactStatus.innerHTML = 'All Systems Operational';
    updatePetForEvent('idle');
  } else {
    var names = Array.from(activePendingAgents).join(', ');
    compactStatus.innerHTML = '<span class="highlight">' + notifCount + ' Pending</span> | ' + names;
  }
  document.getElementById('footer-stat').textContent = activePendingAgents.size + ' agents active';
}

function createNotification(data) {
  if (data.action) activePendingAgents.add(data.agent);
  updatePetForEvent(data.eventType, data.tool);
  sound.playForEvent(data.eventType);
  if (currentState === 'circle') setIslandState('pill');

  var card = document.createElement('div');
  card.className = 'notif-card';
  card.dataset.agent = data.agent;
  var agentPet = AGENT_PETS[data.agent] || 'octopus';

  var html = '<div class="notif-header">';
  html += '<span class="agent-badge" style="color: var(--' + data.agent.toLowerCase() + '-color)"><span class="agent-pet-icon"><div class="pixel-pet ' + agentPet + ' tiny"><div class="sprite"></div></div></span> ' + data.agent + '</span>';
  html += '<button class="btn-jump jump-btn" title="Jump to ' + data.agent + '">Jump ↗</button>';
  html += '</div>';
  html += '<div class="notif-body">' + data.text + '</div>';

  if (data.actionType) {
    html += '<div class="action-type"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> ' + data.actionType + '</div>';
  }

  if (data.code) {
    var linesHtml = data.code.lines.map(function(line) {
      if (line.startsWith('+')) return '<span style="color:#22c55e">' + line + '</span>';
      if (line.startsWith('-')) return '<span style="color:#ef4444">' + line + '</span>';
      return line === '' ? '&nbsp;' : line;
    }).join('<br>');
    html += '<div class="notif-code"><div class="filename">' + data.code.filename + ' ' + (data.code.tag ? '<span>' + data.code.tag + '</span>' : '') + '</div>';
    html += '<div class="code-content"><div class="line-nums">' + data.code.lines.map(function(_, i) { return i + 1; }).join('<br>') + '</div>';
    html += '<div class="lines">' + linesHtml + '</div></div></div>';
  }

  if (data.action) {
    html += '<div class="notif-actions">';
    html += '<button class="btn btn-deny allow-btn">Deny</button>';
    html += '<button class="btn btn-allow-once allow-btn">Allow Once</button>';
    html += '<button class="btn btn-allow-all allow-btn">Allow All</button>';
    html += '<button class="btn btn-bypass allow-btn">Bypass</button>';
    html += '</div>';
    notifCount++;
  }

  card.innerHTML = html;
  feed.insertBefore(card, feed.firstChild);
  updateCompactStatusDisplay();
  if (currentState === 'expanded') updateIslandHeight();

  // Jump button
  card.querySelector('.jump-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    sound.play('click');
    alert('Jump to ' + data.agent + ' terminal');
  });

  if (data.action) {
    card.querySelectorAll('.allow-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        sound.play('complete');
        updatePetForEvent('complete');
        btn.innerText = '✓';
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        setTimeout(function() { removeCard(card, data.agent); }, 600);
      });
    });
  } else {
    setTimeout(function() { removeCard(card, data.agent, true); }, 8000);
  }
}

function removeCard(card, agentName, isInfo) {
  if (!feed.contains(card)) return;
  card.style.height = card.offsetHeight + 'px';
  void card.offsetHeight;
  card.classList.add('card-out');
  setTimeout(function() {
    if (!feed.contains(card)) return;
    card.remove();
    if (!isInfo) notifCount--;
    var still = false;
    feed.querySelectorAll('.notif-card').forEach(function(n) {
      if (n.dataset.agent === agentName && n.querySelector('.allow-btn')) still = true;
    });
    if (!still) activePendingAgents.delete(agentName);
    updateCompactStatusDisplay();
    if (currentState === 'expanded') updateIslandHeight();
  }, 300);
}

// ═══ Init ═══
setPixelPetType('octopus');
updatePetForEvent('sleeping');

setTimeout(function() { createNotification(mockMessages[0]); }, 500);
setTimeout(function() { createNotification(mockMessages[1]); }, 2500);
setTimeout(function() { createNotification(mockMessages[2]); }, 5500);
var idx = 3;
setInterval(function() { createNotification(mockMessages[idx]); idx = (idx + 1) % mockMessages.length; }, 8000);
