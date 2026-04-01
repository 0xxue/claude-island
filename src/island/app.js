const islandEl = document.getElementById('island');
const dotEl = document.getElementById('dot');
const dot2El = document.getElementById('dot2');
const statusEl = document.getElementById('status');
const iconEl = document.getElementById('icon');
const detailEl = document.getElementById('detail');

let expanded = false;

const EVENT_CONFIG = {
  stop: { icon: '⏳', status: '等待操作', detail: '正在等待你的下一步操作', dot: '' },
  permission: { icon: '🔐', status: '需要审批', detail: '', dot: 'orange' },
  notification: { icon: '💬', status: '通知', detail: '', dot: 'green' },
  error: { icon: '❌', status: '出错了', detail: '', dot: 'red' },
  start: { icon: '🚀', status: '会话开始', detail: 'Claude Code 已启动', dot: 'green' },
  end: { icon: '✅', status: '已完成', detail: '会话已结束', dot: 'green' },
};

function showIsland(event) {
  if (event.type === 'end') {
    window.island.dismiss();
    return;
  }
  var config = EVENT_CONFIG[event.type] || EVENT_CONFIG.stop;
  statusEl.textContent = config.status;
  dotEl.className = 'dot ' + (config.dot || '');
  dot2El.className = 'dot ' + (config.dot || '');
  iconEl.textContent = config.icon;
  if (event.type === 'permission' && event.tool) {
    detailEl.textContent = '请审批: ' + event.tool;
  } else if (event.message) {
    detailEl.textContent = event.message.substring(0, 80);
  } else {
    detailEl.textContent = config.detail;
  }
  islandEl.classList.add('collapsed');
  islandEl.classList.remove('expanded');
  expanded = false;
}

function doExpand() {
  console.log('EXPAND');
  expanded = true;
  window.island.expand();
  islandEl.classList.add('expanded');
  islandEl.classList.remove('collapsed');
}

function doCollapse() {
  console.log('COLLAPSE');
  expanded = false;
  window.island.collapse();
  islandEl.classList.remove('expanded');
  islandEl.classList.add('collapsed');
}

// Bind click events via JS (not inline onclick)
document.getElementById('collapsed-area').addEventListener('click', function() {
  doExpand();
});

document.getElementById('header-area').addEventListener('click', function() {
  doCollapse();
});

document.getElementById('btn-dismiss').addEventListener('click', function() {
  window.island.dismiss();
});

document.getElementById('btn-focus').addEventListener('click', function() {
  window.island.focusClaudeWindow();
});

// Listen for events from main process
window.island.onEvent(function(event) {
  console.log('Event received:', event);
  showIsland(event);
});

islandEl.classList.add('collapsed');
