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
  if (e.target.closest('.btn') || e.target.closest('.footer-link')) return;
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

// Button handlers
document.querySelectorAll('.btn').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    btn.textContent = '✓ Done';
    btn.style.opacity = '0.5';
    setTimeout(function() { setState('pill'); }, 800);
  });
});

// Start in circle, auto transition to pill after 2s
setTimeout(function() { setState('pill'); }, 2000);
// Then expand after 4s
setTimeout(function() { setState('expanded'); }, 4000);
