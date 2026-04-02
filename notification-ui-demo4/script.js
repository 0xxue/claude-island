// ═══════════════════════════════════════════
// Claude Island — Glass + Pet + Sound
// ═══════════════════════════════════════════

var island = document.getElementById('island');
var dragHandle = document.getElementById('drag-handle');
var feed = document.getElementById('notification-feed');
var pillText = document.getElementById('pill-text');
var pillWave = document.getElementById('pill-wave');
var footerStat = document.getElementById('footer-stat');
var expandedContent = document.querySelector('.expanded-content');
var petSpeechEl = document.getElementById('pet-speech');

// Pet & Sound instances
var pet = new IslandPet('octopus');
var sound = new IslandSound({ volume: 0.3, enabled: true });

var HEADER_H = 44;
var MAX_HEIGHT = 520;

// ═══ Pet UI sync ═══
function updateAllPetEmojis() {
  var emoji = pet.getEmoji();
  document.getElementById('circle-pet').textContent = emoji;
  document.getElementById('pill-pet').textContent = emoji;
  document.getElementById('exp-pet').textContent = emoji;
}

function updatePetState(eventType, toolName) {
  var petState = pet.mapEvent(eventType, toolName);
  pet.setState(petState);

  var cssClass = pet.getCssClass();
  var actionIcon = pet.getActionIcon();
  var speech = pet.getSpeech();

  // Update all pet emojis animation class
  document.querySelectorAll('.pet-emoji').forEach(function(el) {
    el.className = 'pet-emoji ' + cssClass;
  });

  // Update action icons
  document.getElementById('pill-pet-action').textContent = actionIcon;
  document.getElementById('exp-pet-action').textContent = actionIcon;

  // Update speech bubble
  petSpeechEl.textContent = speech;
  petSpeechEl.style.animation = 'none';
  void petSpeechEl.offsetHeight;
  petSpeechEl.style.animation = 'speech-in 0.3s var(--ease)';

  // Show/hide zzz
  var zzz = document.getElementById('circle-zzz');
  zzz.style.display = (petState === 'idle' || petState === 'sleeping') ? 'block' : 'none';
}

// ═══ Pet Selector ═══
document.querySelectorAll('.pet-option').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.pet-option').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    pet.setType(btn.dataset.pet);
    updateAllPetEmojis();
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

var resizeObs = new ResizeObserver(function() {
  if (state === 'expanded') updateHeight();
});
resizeObs.observe(feed);

// ═══ Click: Single / Double ═══
var clickCount = 0;
var clickTimer = null;
var wasDragging = false;

function handleIslandClick(e) {
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
}

island.addEventListener('click', handleIslandClick);

// ═══ Dragging ═══
var isDragging = false;
var dragX = 0, dragY = 0, initDX = 0, initDY = 0;
var offX = 0, offY = 0;

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
  dragX = e.clientX - initDX;
  dragY = e.clientY - initDY;
  if (Math.abs(dragX - offX) > 3 || Math.abs(dragY - offY) > 3) wasDragging = true;
  offX = dragX;
  offY = dragY;
  island.style.transform = 'translate(calc(-50% + ' + offX + 'px), ' + offY + 'px)';
});

document.addEventListener('mouseup', function() {
  if (isDragging) {
    isDragging = false;
    island.style.transition = '';
    setTimeout(function() { wasDragging = false; }, 50);
  }
});

// ═══ Multi-Agent Notifications ═══
var notifCount = 0;
var pendingAgents = new Set();

var AGENT_COLORS = {
  Claude: 'var(--claude-color)',
  Codex: 'var(--codex-color)',
  Gemini: 'var(--gemini-color)',
  Cursor: 'var(--cursor-color)',
};

var mockMessages = [
  {
    agent: 'Claude', text: 'Requests to patch routing middleware to fix CORS.<br><span class="user-msg">You: Fix the CORS headers</span>',
    actionType: 'modify', eventType: 'permission', tool: 'Edit',
    code: { file: 'api.js', tag: 'diff', lines: [
      { type: 'del', text: '- res.header("Access-Control-Allow-Origin", "*");' },
      { type: 'add', text: '+ res.header("Access-Control-Allow-Origin", "https://app.example.com");' },
    ]},
    needsAction: true,
  },
  {
    agent: 'Gemini', text: 'Database indexing scan completed. Query speeds improved by 40%.',
    actionType: 'info', eventType: 'tool_done', tool: 'Bash',
    code: null, needsAction: false,
  },
  {
    agent: 'Codex', text: 'Needs approval to execute database migration in terminal.',
    actionType: 'execute', eventType: 'permission', tool: 'Bash',
    code: { file: 'terminal', tag: 'bash', lines: [
      { type: 'normal', text: 'npm run db:migrate -- --force' },
    ]},
    needsAction: true,
  },
  {
    agent: 'Claude', text: 'Optimizing webpack config to reduce bundle size.<br><span class="user-msg">You: Make the bundle smaller</span>',
    actionType: 'write', eventType: 'permission', tool: 'Write',
    code: { file: 'webpack.config.js', tag: '', lines: [
      { type: 'normal', text: '  optimization: {' },
      { type: 'add', text: '+   minimize: true,' },
      { type: 'add', text: '+   splitChunks: { chunks: "all" },' },
      { type: 'normal', text: '  }' },
    ]},
    needsAction: true,
  },
  {
    agent: 'Cursor', text: 'Auto-completed 12 functions in Dashboard.tsx',
    actionType: 'info', eventType: 'tool_done', tool: 'Edit',
    code: null, needsAction: false,
  },
];

function updatePillStatus() {
  if (pendingAgents.size === 0) {
    pillText.innerHTML = 'All Systems Operational';
    pillWave.className = 'pill-wave';
    updatePetState('idle');
  } else {
    var names = Array.from(pendingAgents).join(', ');
    pillText.innerHTML = '<span class="highlight">' + notifCount + ' Pending</span> · Waiting: ' + names;
    pillWave.className = 'pill-wave active';
  }
  footerStat.textContent = pendingAgents.size + ' agents active';
}

function createNotification(data) {
  if (data.needsAction) pendingAgents.add(data.agent);

  // Update pet state & play sound
  updatePetState(data.eventType, data.tool);
  sound.playForEvent(data.eventType);

  // Auto show from circle
  if (state === 'circle') setState('pill');

  var card = document.createElement('div');
  card.className = 'notif-card';
  card.dataset.agent = data.agent;

  var agentColor = AGENT_COLORS[data.agent] || 'var(--accent)';
  var html = '';

  // Header
  html += '<div class="notif-header">';
  html += '<span class="agent-badge"><span class="dot" style="background:' + agentColor + '"></span> ' + data.agent + '</span>';
  if (data.actionType) {
    html += '<span class="action-badge ' + data.actionType + '">' + data.actionType.charAt(0).toUpperCase() + data.actionType.slice(1) + '</span>';
  }
  html += '</div>';

  // Body
  html += '<div class="notif-body">' + data.text + '</div>';

  // Code block
  if (data.code) {
    html += '<div class="notif-code"><div class="code-header"><span class="code-filename">' + data.code.file + '</span>';
    if (data.code.tag) html += '<span class="code-tag">' + data.code.tag + '</span>';
    html += '</div><div class="code-body">';
    data.code.lines.forEach(function(line) {
      html += '<div class="code-line ' + line.type + '">' + line.text + '</div>';
    });
    html += '</div></div>';
  }

  // Actions
  if (data.needsAction) {
    html += '<div class="notif-actions">';
    html += '<button class="btn btn-deny action-btn">Deny</button>';
    html += '<button class="btn btn-once action-btn">Allow Once</button>';
    html += '<button class="btn btn-all action-btn">Allow All</button>';
    html += '<button class="btn btn-bypass action-btn">Bypass</button>';
    html += '</div>';
    notifCount++;
  }

  card.innerHTML = html;
  feed.insertBefore(card, feed.firstChild);
  updatePillStatus();
  if (state === 'expanded') updateHeight();

  // Button handlers
  if (data.needsAction) {
    card.querySelectorAll('.action-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        sound.play('complete');
        updatePetState('complete');
        btn.textContent = '✓ Done';
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
    if (feed.contains(card)) {
      card.remove();
      if (!isInfo) notifCount--;
      var stillPending = false;
      document.querySelectorAll('.notif-card').forEach(function(c) {
        if (c.dataset.agent === agentName && c.querySelector('.action-btn')) stillPending = true;
      });
      if (!stillPending) pendingAgents.delete(agentName);
      updatePillStatus();
      if (state === 'expanded') updateHeight();
    }
  }, 300);
}

// ═══ Init ═══
updateAllPetEmojis();
updatePetState('sleeping');

// Demo: simulate concurrent agents
setTimeout(function() { createNotification(mockMessages[0]); }, 1000);
setTimeout(function() { createNotification(mockMessages[1]); }, 3000);
setTimeout(function() { createNotification(mockMessages[2]); }, 6000);

var msgIndex = 3;
setInterval(function() {
  createNotification(mockMessages[msgIndex]);
  msgIndex = (msgIndex + 1) % mockMessages.length;
}, 9000);
