// --- UI Elements ---
const dynamicIsland = document.getElementById('dynamic-island');
const dragHandle = document.getElementById('drag-handle');
const feed = document.getElementById('notification-feed');
const compactStatus = document.getElementById('compact-status');
const expandedContent = document.querySelector('.island-expanded-content');

const MAX_EXPANDED_HEIGHT = 560;
const HEADER_HEIGHT = 44;

// current state tracking
let currentState = 'pill'; // 'circle', 'pill', 'expanded'

// --- Dragging Logic ---
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;
let wasDragging = false; 

dragHandle.addEventListener("mousedown", dragStart, false);
document.addEventListener("mouseup", dragEnd, false);
document.addEventListener("mousemove", drag, false);

function dragStart(e) {
    if (e.target.closest('.btn') || e.target.closest('.footer-link')) return; 
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === dragHandle || dragHandle.contains(e.target)) {
        isDragging = true;
        wasDragging = false; 
    }
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    setTimeout(() => { if (!isDragging) wasDragging = false; }, 50);
    isDragging = false;
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        
        if (Math.abs(currentX) > 3 || Math.abs(currentY) > 3) {
            wasDragging = true;
        }
        
        dynamicIsland.style.top = '20px';
        dynamicIsland.style.left = '50%';
        dynamicIsland.style.transform = `translate(calc(-50% + ${currentX}px), ${currentY}px)`;
    }
}

// --- Island Size & State Logic ---

function updateIslandHeight() {
    if (currentState === 'expanded') {
        dynamicIsland.style.height = 'auto';
        let contentHeight = expandedContent.scrollHeight;
        let totalHeight = HEADER_HEIGHT + contentHeight;
        if (totalHeight > MAX_EXPANDED_HEIGHT) totalHeight = MAX_EXPANDED_HEIGHT;
        dynamicIsland.style.height = totalHeight + 'px';
    } else {
        dynamicIsland.style.height = '44px';
    }
}

function setIslandState(newState) {
    currentState = newState;
    dynamicIsland.classList.remove('island-circle', 'island-pill', 'island-expanded');
    dynamicIsland.classList.add(`island-${newState}`);
    updateIslandHeight();
}

const resizeObserver = new ResizeObserver(() => {
    if (currentState === 'expanded') {
        updateIslandHeight();
    }
});
resizeObserver.observe(feed);

// --- Click Interaction Logic (Single vs Double) ---
let clickTimeout;
let clickCount = 0;

dragHandle.addEventListener('click', (e) => {
    if (wasDragging) return; 
    if (e.target.closest('.btn') || e.target.closest('.footer-link')) return; 

    clickCount++;
    if (clickCount === 1) {
        clickTimeout = setTimeout(() => {
            handleSingleClick();
            clickCount = 0;
        }, 220); 
    } else if (clickCount === 2) {
        clearTimeout(clickTimeout);
        handleDoubleClick();
        clickCount = 0;
    }
});

function handleSingleClick() {
    if (currentState === 'circle') setIslandState('pill');
    else if (currentState === 'pill') setIslandState('expanded');
    else if (currentState === 'expanded') setIslandState('pill');
}

function handleDoubleClick() {
    if (currentState === 'circle') setIslandState('expanded');
    else if (currentState === 'pill') setIslandState('circle');
    else if (currentState === 'expanded') setIslandState('circle');
}

// --- Multi-Agent Notification Logic ---
let notifCount = 0;
const activePendingAgents = new Set(); // Keep track of agents awaiting approval

const mockMessages = [
    { 
        agent: 'Claude', 
        text: 'Requests to patch the routing middleware to fix the CORS issue.<br><span style="color:#8b8d96">You: Fix the CORS headers in server context</span>',
        actionType: 'Modify',
        code: { filename: 'api.js', tag: 'diff', lines: ['- res.header("Access-Control-Allow-Origin", "*");', '+ res.header("Access-Control-Allow-Origin", "https://app.example.com");'] }, 
        action: true 
    },
    { 
        agent: 'Gemini', 
        text: 'Completed background database indexing scan successfully. Query speeds improved by 40%.',
        actionType: 'Process',
        code: null, 
        action: false 
    },
    { 
        agent: 'Codex', 
        text: 'Needs approval to execute database migration scripts in the active terminal.',
        actionType: 'Execute',
        code: { filename: 'terminal', tag: 'bash', lines: ['npm run db:migrate -- --force'] }, 
        action: true 
    },
    { 
        agent: 'Claude', 
        text: 'Suggests optimizing the main webpack chunk to reduce load time.<br><span style="color:#8b8d96">You: Make the bundle size smaller</span>',
        actionType: 'Settings',
        code: { filename: 'webpack.config.js', tag: '', lines: ['  optimization: {', '    minimize: true,', '  }'] }, 
        action: true 
    }
];

function updateCompactStatusDisplay() {
    if (activePendingAgents.size === 0) {
        compactStatus.innerHTML = `All Systems Operational`;
        document.querySelector('.glow-orb').className = 'glow-orb';
    } else {
        const agentNames = Array.from(activePendingAgents).join(', ');
        compactStatus.innerHTML = `<span class="highlight">${notifCount} Pending</span> | Waiting on: ${agentNames}`;
        document.querySelector('.glow-orb').className = 'glow-orb anim-pulse';
    }
}

function createNotification(data) {
    if (data.action) activePendingAgents.add(data.agent);
    
    // Automatically switch states out of circle if new notification arrives
    if (currentState === 'circle') setIslandState('pill');
    
    const card = document.createElement('div');
    card.className = 'notif-card';
    card.dataset.agent = data.agent; // This matches CSS edge highlighting colors
    
    let html = `
        <div class="notif-header">
            <span class="agent-badge" style="color: var(--${data.agent.toLowerCase()}-color)">${data.agent} • </span>
        </div>
        <div class="notif-body">
            ${data.text}
        </div>
        ${data.actionType ? `<div class="action-type"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> ${data.actionType}</div>` : ''}
    `;
    
    if (data.code) {
        // Change text color in lines to differentiate bash/diff/normal
        let linesHtml = data.code.lines.map(line => {
            if (line.startsWith('+')) return `<span style="color:#22c55e">${line}</span>`;
            if (line.startsWith('-')) return `<span style="color:#ef4444">${line}</span>`;
            return line === '' ? '&nbsp;' : line;
        }).join('<br>');
        
        html += `
            <div class="notif-code">
                <div class="filename">${data.code.filename} ${data.code.tag ? `<span>${data.code.tag}</span>` : ''}</div>
                <div class="code-content">
                    <div class="line-nums">
                        ${data.code.lines.map((_, i) => i + 1).join('<br>')}
                    </div>
                    <div class="lines">
                        ${linesHtml}
                    </div>
                </div>
            </div>
        `;
    }
    
    if (data.action) {
        html += `
            <div class="notif-actions">
                <button class="btn btn-deny allow-btn">Deny</button>
                <button class="btn btn-allow-once allow-btn">Allow Once</button>
                <button class="btn btn-allow-all allow-btn">Allow All</button>
                <button class="btn btn-bypass allow-btn">Bypass</button>
            </div>
        `;
        notifCount++;
    }
    
    card.innerHTML = html;
    feed.insertBefore(card, feed.firstChild);
    
    updateCompactStatusDisplay();
    if (currentState === 'expanded') updateIslandHeight();
    
    if (data.action) {
        const btns = card.querySelectorAll('.allow-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.innerText = 'Recorded';
                setTimeout(() => removeCard(card, data.agent), 800);
            });
        });
    } else {
        setTimeout(() => removeCard(card, data.agent, true), 8000);
    }
}

function removeCard(card, agentName, isInfo = false) {
    if (!feed.contains(card)) return;
    card.style.height = card.offsetHeight + 'px';
    void card.offsetHeight; 
    card.classList.add('card-out');
    
    setTimeout(() => {
        if (feed.contains(card)) {
            card.remove();
            
            if (!isInfo) notifCount--;
            
            // Check if this was the last action for this agent to remove from pending set
            let stillHasAgent = false;
            document.querySelectorAll('.notif-card').forEach(n => {
                if(n.dataset.agent === agentName && n.querySelector('.allow-btn')) stillHasAgent = true;
            });
            if (!stillHasAgent) activePendingAgents.delete(agentName);
            
            updateCompactStatusDisplay();
            if(currentState === 'expanded') updateIslandHeight();
        }
    }, 300);
}

// Initial pops to simulate concurrent agents
setTimeout(() => createNotification(mockMessages[0]), 500); // Claude asks routing config
setTimeout(() => createNotification(mockMessages[1]), 2500); // Gemini purely informs
setTimeout(() => createNotification(mockMessages[2]), 5500); // Codex needs terminal execution

// keep throwing
let index = 3;
setInterval(() => {
    createNotification(mockMessages[index]);
    index = (index + 1) % mockMessages.length;
}, 8000);
