const island = document.getElementById('island');
let state = 'circle';
let clickCount = 0;
let clickTimer = null;
let stateTime = Date.now();

function setState(s) {
  state = s;
  stateTime = Date.now();
  island.className = 'island island-' + s;
}

island.addEventListener('click', function(e) {
  if (e.target.closest('.btn')) return;
  if (Date.now() - stateTime < 400) return;
  clickCount++;
  if (clickCount === 1) {
    clickTimer = setTimeout(function() {
      if (state === 'circle') setState('pill');
      else if (state === 'pill') setState('expanded');
      else if (state === 'expanded') setState('pill');
      clickCount = 0;
    }, 250);
  } else if (clickCount === 2) {
    clearTimeout(clickTimer);
    clickCount = 0;
    if (state === 'circle') setState('expanded');
    else setState('circle');
  }
});

document.querySelectorAll('.btn').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    btn.textContent = '✓';
    btn.style.color = '#00FF41';
    setTimeout(function() { setState('pill'); }, 600);
  });
});

setTimeout(function() { setState('pill'); }, 1500);
setTimeout(function() { setState('expanded'); }, 3500);
