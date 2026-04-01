var islandEl = document.getElementById('island');
var dotEl = document.getElementById('dot');
var dot2El = document.getElementById('dot2');
var labelEl = document.getElementById('label');
var statusEl = document.getElementById('status');
var iconEl = document.getElementById('icon');
var detailEl = document.getElementById('detail');

var expanded = false;

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
  islandEl.classList.remove('pulse');
  void islandEl.offsetWidth; // force reflow
  islandEl.classList.add('pulse');
}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

function showIsland(event) {
  var icon = '⚡', detail = '', statusText = '', statusCls = '';

  switch (event.type) {
    case 'tool_start':
      icon = '⚡';
      statusText = tl(event.tool) + '...';
      statusCls = 'active';
      if (event.file) detail = sp(event.file);
      else if (event.command) detail = '$ ' + event.command;
      else if (event.pattern || event.query) detail = event.pattern || event.query;
      else detail = '执行中';
      labelEl.textContent = 'Claude Code';
      break;

    case 'tool_done':
      icon = '✓';
      statusText = tl(event.tool) + ' ✓';
      statusCls = 'done';
      detail = event.file ? sp(event.file) : '完成';
      labelEl.textContent = 'Claude Code';
      break;

    case 'permission':
      icon = '🔐';
      statusText = '需要审批';
      statusCls = 'warn';
      detail = event.tool && event.file ? tl(event.tool) + ': ' + sp(event.file) : event.tool ? '审批: ' + tl(event.tool) : '等待审批';
      labelEl.textContent = 'Claude Code';
      triggerPulse();
      break;

    case 'stop':
      icon = '💬';
      statusText = '等待输入';
      statusCls = '';
      detail = event.message ? event.message.substring(0, 50) : '等待你的下一步';
      labelEl.textContent = 'Claude Code';
      triggerPulse();
      break;

    case 'notification':
      icon = '📢';
      statusText = event.title || '通知';
      statusCls = 'done';
      detail = event.message || '';
      labelEl.textContent = 'Claude Code';
      triggerPulse();
      break;

    case 'start':
      icon = '🚀';
      statusText = '会话开始';
      statusCls = 'done';
      detail = '新会话';
      labelEl.textContent = 'Claude Code';
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

  // Auto collapse on new event
  if (expanded) {
    expanded = false;
    window.island.collapse();
    islandEl.classList.remove('expanded');
    islandEl.classList.add('collapsed');
  }
}

function doExpand() {
  expanded = true;
  window.island.expand();
  islandEl.classList.add('expanded');
  islandEl.classList.remove('collapsed');
}

function doCollapse() {
  expanded = false;
  window.island.collapse();
  islandEl.classList.remove('expanded');
  islandEl.classList.add('collapsed');
}

document.getElementById('collapsed-area').addEventListener('click', doExpand);
document.getElementById('header-area').addEventListener('click', doCollapse);
document.getElementById('btn-dismiss').addEventListener('click', function() { window.island.dismiss(); });
document.getElementById('btn-focus').addEventListener('click', function() { window.island.focusClaudeWindow(); });

window.island.onEvent(function(event) {
  showIsland(event);
});

islandEl.classList.add('collapsed');
