var islandEl = document.getElementById('island');
var dotEl = document.getElementById('dot');
var dot2El = document.getElementById('dot2');
var labelEl = document.getElementById('label');
var statusEl = document.getElementById('status');
var iconEl = document.getElementById('icon');
var detailEl = document.getElementById('detail');

// 3 states: 'dot' | 'collapsed' | 'expanded'
var state = 'collapsed';
var lockExpand = false;
var lockTimer = null;
var clickTimer = null;
var clickCount = 0;
var stateChangeTime = 0;
var currentSource = '';

var TOOL_LABELS = {
  'Edit': '编辑', 'Write': '写入', 'Read': '读取', 'Bash': '命令',
  'Glob': '搜索文件', 'Grep': '搜索内容', 'Agent': '子任务',
  'WebSearch': '网页搜索', 'WebFetch': '抓取网页', 'Skill': '技能',
};

function tl(n) { return TOOL_LABELS[n] || n || '工具'; }
function sp(p) {
  if (!p) return '';
  var s = p.replace(/\\/g, '/').split('/');
  return s.length > 2 ? '.../' + s.slice(-2).join('/') : p;
}

function triggerPulse() {
  if (state === 'dot') return;
  islandEl.classList.remove('pulse');
  void islandEl.offsetWidth;
  islandEl.classList.add('pulse');
}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

// ═══ State transitions ═══
var dotVisual = document.querySelector('.dot-visual');

function goToDot() {
  state = 'dot';
  stateChangeTime = Date.now();
  islandEl.className = 'island dot-state';
  dotVisual.style.display = 'block';
}

function goToCollapsed() {
  state = 'collapsed';
  stateChangeTime = Date.now();
  islandEl.className = 'island collapsed';
  dotVisual.style.display = 'none';
}

function goToExpanded() {
  state = 'expanded';
  stateChangeTime = Date.now();
  islandEl.className = 'island expanded';
  dotVisual.style.display = 'none';
}

// ═══ Drag support (RAF throttled) ═══
var isDragging = false;
var dragStartX = 0, dragStartY = 0;
var wasDragged = false;
var pendingDx = 0, pendingDy = 0;
var dragRaf = null;

document.addEventListener('mousedown', function(e) {
  if (e.target.tagName === 'BUTTON') return;
  isDragging = true;
  wasDragged = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  pendingDx = 0;
  pendingDy = 0;
  // Disable CSS transitions during drag for smoother movement
  islandEl.style.transition = 'none';
});

document.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  var dx = e.screenX - dragStartX;
  var dy = e.screenY - dragStartY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    wasDragged = true;
    pendingDx += dx;
    pendingDy += dy;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    // Batch moves into one RAF frame
    if (!dragRaf) {
      dragRaf = requestAnimationFrame(function() {
        window.island.drag(pendingDx, pendingDy);
        pendingDx = 0;
        pendingDy = 0;
        dragRaf = null;
      });
    }
  }
});

document.addEventListener('mouseup', function() {
  isDragging = false;
  // Restore CSS transitions after drag
  islandEl.style.transition = '';
});

// ═══ Click handler: single / double / triple ═══
function handleClick(e) {
  if (e && e.target.tagName === 'BUTTON') return;
  if (wasDragged) { wasDragged = false; return; } // Ignore click after drag
  if (Date.now() - stateChangeTime < 500) return;

  clickCount++;

  if (clickCount === 1) {
    clickTimer = setTimeout(function() {
      // Single click
      if (state === 'dot') goToCollapsed();
      else if (state === 'collapsed') goToExpanded();
      else if (state === 'expanded') goToCollapsed();
      clickCount = 0;
    }, 300);
  } else if (clickCount === 2) {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(function() {
      // Double click (wait a bit to check for triple)
      if (state === 'collapsed') goToDot();
      else if (state === 'expanded') goToDot();
      else if (state === 'dot') goToExpanded();
      clickCount = 0;
    }, 300);
  } else if (clickCount === 3) {
    clearTimeout(clickTimer);
    clickCount = 0;
    // Triple click — recenter
    window.island.recenter();
  }
}

// ═══ Event display ═══
function showIsland(event) {
  // Track source — only update on stop/permission
  if (event.source && (event.type === 'stop' || event.type === 'permission')) {
    currentSource = event.source;
  }

  // Dot state: ignore all events except permission
  if (state === 'dot') {
    if (event.type === 'permission') {
      goToCollapsed();
    } else {
      return;
    }
  }

  var icon = '⚡', detail = '', statusText = '', statusCls = '';

  switch (event.type) {
    case 'tool_start':
      icon = '⚡'; statusText = tl(event.tool) + '...'; statusCls = 'active';
      if (event.file) detail = sp(event.file);
      else if (event.command) detail = '$ ' + event.command;
      else if (event.pattern || event.query) detail = event.pattern || event.query;
      else detail = '执行中';
      break;
    case 'tool_done':
      icon = '✓'; statusText = tl(event.tool) + ' ✓'; statusCls = 'done';
      detail = event.file ? sp(event.file) : '完成';
      break;
    case 'permission':
      icon = '🔐'; statusText = '需要审批'; statusCls = 'warn';
      detail = event.tool && event.file ? tl(event.tool) + ': ' + sp(event.file) : event.tool ? '审批: ' + tl(event.tool) : '等待审批';
      triggerPulse();
      break;
    case 'stop':
      icon = '💬'; statusText = '等待输入'; statusCls = '';
      detail = event.message ? event.message.substring(0, 50) : '等待你的下一步';
      triggerPulse();
      break;
    case 'notification':
      icon = '📢'; statusText = event.title || '通知'; statusCls = 'done';
      detail = event.message || '';
      triggerPulse();
      break;
    case 'start':
      icon = '🚀'; statusText = '会话开始'; statusCls = 'done';
      detail = '新会话';
      break;
    case 'end':
      window.island.dismiss();
      return;
  }

  setStatus(statusText, statusCls);
  dotEl.className = 'dot' + (statusCls === 'done' ? ' green' : statusCls === 'warn' ? ' orange' : statusCls === 'active' ? ' blue' : '');
  dot2El.className = dotEl.className;
  iconEl.textContent = icon;
  detailEl.textContent = detail;

}

// ═══ Bind events ═══
document.getElementById('collapsed-area').addEventListener('click', handleClick);
document.getElementById('header-area').addEventListener('click', handleClick);
// Dot state: click anywhere in window to restore
document.body.addEventListener('click', function(e) {
  if (state === 'dot') handleClick(e);
});

document.getElementById('btn-dismiss').addEventListener('click', function(e) {
  e.stopPropagation();
  goToDot();
});
document.getElementById('btn-focus').addEventListener('click', function(e) {
  e.stopPropagation();
  window.island.focusClaudeWindow(currentSource);
});

window.island.onEvent(function(event) {
  showIsland(event);
});

// Auto-expand: force=true (permission) ignores dot, force=false (stop+away) respects dot
window.island.onAutoExpand(function(force) {
  if (!force && state === 'dot') return;
  lockExpand = true;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(function() { lockExpand = false; }, 8000);
  goToExpanded();
});

// Mouse enter/leave — make window clickable only when hovering the island
islandEl.addEventListener('mouseenter', function() {
  window.island.setClickable(true);
});
islandEl.addEventListener('mouseleave', function() {
  window.island.setClickable(false);
});

// Start collapsed
goToCollapsed();
