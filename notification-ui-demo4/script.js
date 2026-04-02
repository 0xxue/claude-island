// ═══════════════════════════════════════════
// Claude Island — Glass Theme — Full Feature
// ═══════════════════════════════════════════

const island = document.getElementById('island');
const dragHandle = document.getElementById('drag-handle');
const feed = document.getElementById('notification-feed');
const pillText = document.getElementById('pill-text');
const pillDot = document.getElementById('pill-dot');
const pillWave = document.getElementById('pill-wave');
const footerStat = document.getElementById('footer-stat');
const expandedContent = document.querySelector('.expanded-content');

const MAX_HEIGHT = 520;
const HEADER_H = 42;

// ═══ State Machine ═══
let state = 'circle';
let stateTime = Date.now();

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
    island.style.height = '48px';
  }
}

const resizeObs = new ResizeObserver(function() {
  if (state === 'expanded') updateHeight();
});
resizeObs.observe(feed);

// ═══ Click: Single / Double ═══
let clickCount = 0;
let clickTimer = null;

function handleIslandClick(e) {
  if (e.target.closest('.btn') || e.target.closest('.footer-link')) return;
  if (wasDragging) return;
  if (Date.now() - stateTime < 400) return;

  clickCount++;
  if (clickCount === 1) {
    clickTimer = setTimeout(function() {
      if (state === 'circle') setState('pill');
      else if (state === 'pill') setState('expanded');
      else if (state === 'expanded') setState('pill');
      clickCount = 0;
    }, 220);
  } else if (clickCount === 2) {
    clearTimeout(clickTimer);
    clickCount = 0;
    if (state === 'circle') setState('expanded');
    else setState('circle');
  }
}

island.addEventListener('click', handleIslandClick);

// ═══ Dragging (CSS transform, no IPC) ═══
let isDragging = false;
let wasDragging = false;
let dragX = 0, dragY = 0, initDragX = 0, initDragY = 0;
let offsetX = 0, offsetY = 0;

dragHandle.addEventListener('mousedown', function(e) {
  if (e.target.closest('.btn') || e.target.closest('.footer-link')) return;
  isDragging = true;
  wasDragging = false;
  initDragX = e.clientX - offsetX;
  initDragY = e.clientY - offsetY;
  island.style.transition = 'border-radius 0.45s, width 0.45s, background 0.45s, border-color 0.45s, box-shadow 0.45s';
});

document.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  e.preventDefault();
  dragX = e.clientX - initDragX;
  dragY = e.clientY - initDragY;
  if (Math.abs(dragX - offsetX) > 3 || Math.abs(dragY - offsetY) > 3) wasDragging = true;
  offsetX = dragX;
  offsetY = dragY;
  island.style.transform = 'translate(calc(-50% + ' + offsetX + 'px), ' + offsetY + 'px)';
});

document.addEventListener('mouseup', function() {
  if (isDragging) {
    isDragging = false;
    island.style.transition = '';
    setTimeout(function() { wasDragging = false; }, 50);
  }
});

// ═══ Multi-Agent Notifications ═══
let notifCount = 0;
const pendingAgents = new Set();

const AGENT_COLORS = {
  Claude: 'var(--claude-color)',
  Codex: 'var(--codex-color)',
  Gemini: 'var(--gemini-color)',
  Cursor: 'var(--cursor-color)',
};

const mockMessages = [
  {
    agent: 'Claude',
    text: 'Requests to patch the routing middleware to fix CORS.<br><span class="user-msg">You: Fix the CORS headers</span>',
    actionType: 'modify',
    code: { file: 'api.js', tag: 'diff', lines: [
      { type: 'del', text: '- res.header("Access-Control-Allow-Origin", "*");' },
      { type: 'add', text: '+ res.header("Access-Control-Allow-Origin", "https://app.example.com");' },
    ]},
    needsAction: true,
  },
  {
    agent: 'Gemini',
    text: 'Database indexing scan completed. Query speeds improved by 40%.',
    actionType: 'info',
    code: null,
    needsAction: false,
  },
  {
    agent: 'Codex',
    text: 'Needs approval to execute database migration in terminal.',
    actionType: 'execute',
    code: { file: 'terminal', tag: 'bash', lines: [
      { type: 'normal', text: 'npm run db:migrate -- --force' },
    ]},
    needsAction: true,
  },
  {
    agent: 'Claude',
    text: 'Suggests optimizing webpack config to reduce bundle size.<br><span class="user-msg">You: Make the bundle smaller</span>',
    actionType: 'write',
    code: { file: 'webpack.config.js', tag: '', lines: [
      { type: 'normal', text: '  optimization: {' },
      { type: 'add', text: '+   minimize: true,' },
      { type: 'add', text: '+   splitChunks: { chunks: "all" },' },
      { type: 'normal', text: '  }' },
    ]},
    needsAction: true,
  },
  {
    agent: 'Cursor',
    text: 'Auto-completed 12 functions in components/Dashboard.tsx',
    actionType: 'info',
    code: null,
    needsAction: false,
  },
];

function updatePillStatus() {
  if (pendingAgents.size === 0) {
    pillText.innerHTML = 'All Systems Operational';
    pillDot.className = 'pill-indicator active';
    pillWave.className = 'pill-wave';
  } else {
    var names = Array.from(pendingAgents).join(', ');
    pillText.innerHTML = '<span class="highlight">' + notifCount + ' Pending</span> · Waiting: ' + names;
    pillDot.className = 'pill-indicator warn';
    pillWave.className = 'pill-wave active';
  }
  footerStat.textContent = pendingAgents.size + ' agents active';
}

function createNotification(data) {
  if (data.needsAction) pendingAgents.add(data.agent);

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
    html += '<div class="notif-code">';
    html += '<div class="code-header"><span class="code-filename">' + data.code.file + '</span>';
    if (data.code.tag) html += '<span class="code-tag">' + data.code.tag + '</span>';
    html += '</div>';
    html += '<div class="code-body">';
    data.code.lines.forEach(function(line) {
      html += '<div class="code-line ' + line.type + '">' + line.text + '</div>';
    });
    html += '</div></div>';
  }

  // Action buttons
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
        btn.textContent = '✓ Done';
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        setTimeout(function() { removeCard(card, data.agent); }, 600);
      });
    });
  } else {
    // Info notifications auto-dismiss after 8s
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

      // Check if agent still has pending cards
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

// ═══ Demo: simulate concurrent agents ═══
setTimeout(function() { createNotification(mockMessages[0]); }, 800);
setTimeout(function() { createNotification(mockMessages[1]); }, 2500);
setTimeout(function() { createNotification(mockMessages[2]); }, 5000);

var msgIndex = 3;
setInterval(function() {
  createNotification(mockMessages[msgIndex]);
  msgIndex = (msgIndex + 1) % mockMessages.length;
}, 9000);
