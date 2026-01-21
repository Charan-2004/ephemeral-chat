const socket = io();
const loginForm = document.getElementById('admin-login-form');
const loginScreen = document.getElementById('admin-login-screen');
const dashboard = document.getElementById('admin-dashboard');

let adminToken = localStorage.getItem('adminToken');
let adminUsername = localStorage.getItem('adminUsername') || 'Moderator';
let currentMonitorRoom = '';

// Helper for authenticated requests
async function authFetch(url, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        'Authorization': adminToken,
        ...options.headers
    };

    try {
        const res = await fetch(url, options);
        if (res.status === 401) {
            alert('Session Expired. Please Login Again.');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUsername');
            location.reload();
            return null;
        }
        if (!res.ok) throw new Error(res.statusText);
        return res;
    } catch (e) {
        alert('Action Failed: ' + e.message);
        console.error(e);
        throw e;
    }
}

// Auth
if (adminToken) {
    showDashboard();
    loadStats();
    loadRooms();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = JSON.stringify({
        username: document.getElementById('admin-user').value,
        password: document.getElementById('admin-pass').value,
        secret: document.getElementById('admin-secret').value
    });

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        const data = await res.json();

        if (data.success) {
            adminToken = data.token;
            adminUsername = data.username;
            localStorage.setItem('adminToken', adminToken);
            localStorage.setItem('adminUsername', adminUsername);
            showDashboard();
            loadStats();
            loadRooms();
        } else {
            document.getElementById('login-error').innerText = data.error;
        }
    } catch (e) { console.error(e); }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    location.reload();
});

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'flex';
}

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// Stats
async function loadStats() {
    try {
        const res = await authFetch('/api/admin/stats');
        if (!res) return;
        const data = await res.json();
        document.getElementById('stat-users').innerText = data.users;
        document.getElementById('stat-rooms').innerText = data.activeRooms;
    } catch (e) { console.error('Stats load invalid'); }
}

// Rooms
async function loadRooms() {
    const res = await fetch('/api/rooms'); // Public endpoint is fine for list
    const rooms = await res.json();
    const list = document.getElementById('admin-room-list');
    list.innerHTML = '';

    rooms.forEach(r => {
        const li = document.createElement('li');
        li.style.background = '#222';
        li.style.padding = '10px';
        li.style.marginBottom = '5px';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';

        // Encode naming for safety in data attributes
        const safeName = encodeURIComponent(r.name);

        li.innerHTML = `
            <span>${r.name} ${r.locked ? '<span style="color:red">[LOCKED]</span>' : ''}</span>
            <div>
                 <button class="action-btn-lock" data-room="${safeName}" data-locked="${r.locked}">
                    ${r.locked ? 'Unlock' : 'Lock'}
                 </button>
                 <button class="action-btn-delete-room" data-room="${safeName}" style="background:red; color:white;">Delete</button>
            </div>
        `;
        list.appendChild(li);
    });

    // Also Populate Monitor Select
    const sel = document.getElementById('monitor-room-select');
    sel.innerHTML = '<option value="">Select Room</option>';
    rooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.innerText = r.name;
        sel.appendChild(opt);
    });
}

// Create Room
document.getElementById('add-room-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-room-name');
    const roomName = nameInput.value.trim();
    if (!roomName) return alert('Please enter a room name');

    await authFetch('/api/admin/rooms', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', roomName })
    });
    nameInput.value = '';
    loadRooms();
});

// Room Actions Delegation
document.getElementById('admin-room-list').addEventListener('click', async (e) => {
    // Handle Lock/Unlock
    const lockBtn = e.target.closest('.action-btn-lock');
    if (lockBtn) {
        const room = decodeURIComponent(lockBtn.dataset.room);
        const isLocked = lockBtn.dataset.locked === 'true';
        const action = isLocked ? 'unlock' : 'lock';

        const reason = action === 'lock' ? prompt('Reason?') : '';
        if (action === 'lock' && reason === null) return; // Cancelled

        await authFetch('/api/admin/rooms', {
            method: 'POST',
            body: JSON.stringify({ action, roomName: room, reason })
        });
        loadRooms();
        return;
    }

    // Handle Delete Room
    const delBtn = e.target.closest('.action-btn-delete-room');
    if (delBtn) {
        const room = decodeURIComponent(delBtn.dataset.room);
        if (!confirm(`Delete room "${room}"?`)) return;

        await authFetch('/api/admin/rooms', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', roomName: room })
        });
        loadRooms();
        return;
    }
});

// Monitor
document.getElementById('monitor-room-select').addEventListener('change', (e) => {
    if (currentMonitorRoom) socket.emit('leaveRoom', { room: currentMonitorRoom }); // Optional if supported
    // For now we just join new
    currentMonitorRoom = e.target.value;
    document.getElementById('monitor-messages').innerHTML = '';
    document.getElementById('admin-chat-input-area').style.display = currentMonitorRoom ? 'flex' : 'none';

    if (currentMonitorRoom) {
        socket.emit('joinRoom', { username: 'AdminMonitor', room: currentMonitorRoom });
    }
});

// Admin Chat
document.getElementById('admin-chat-btn').addEventListener('click', () => {
    const txt = document.getElementById('admin-chat-input').value;
    if (txt && currentMonitorRoom) {
        socket.emit('adminChat', { text: txt, room: currentMonitorRoom, username: adminUsername });
        document.getElementById('admin-chat-input').value = '';
    }
});

// Unpin logic (Attached via ID now)
document.getElementById('admin-unpin-btn').addEventListener('click', async () => {
    try {
        await authFetch('/api/admin/messages/unpin', { method: 'POST' });
        alert('Unpinned!');
    } catch (e) { /* handled by authFetch */ }
});

socket.on('message', (msg) => {
    if (msg.room === currentMonitorRoom) {
        const div = document.createElement('div');
        div.className = 'admin-msg';
        div.id = `msg-${msg.id}`;

        // Controls (System check)
        let controlsHtml = '';
        if (msg.username !== 'System') {
            // Encode text safely for data attribute
            const safeText = encodeURIComponent(msg.text || '');

            controlsHtml = `
            <div class="admin-controls">
                <button class="action-btn-delete" data-id="${msg.id}" title="Delete" style="background:none; border:none; color:#f04747; cursor:pointer;"><i class="fas fa-trash"></i></button>
                <button class="action-btn-pin" data-id="${msg.id}" data-text="${safeText}" title="Pin" style="background:none; border:none; color:#f5a623; cursor:pointer;"><i class="fas fa-thumbtack"></i></button>
            </div>`;
        }

        const displayContent = msg.text || '<em>[Image]</em>';
        div.innerHTML = `
        const strong = document.createElement('strong');
        strong.innerText = msg.username + ': ';
        div.appendChild(strong);

        const textSpan = document.createElement('span');
        textSpan.innerText = displayContent;
        div.appendChild(textSpan);

        // Re-append controls
        if (controlsHtml) {
             const controlsDiv = document.createElement('div');
             controlsDiv.className = 'admin-controls';
             controlsDiv.style.display = 'inline-block';
             controlsDiv.style.marginLeft = '10px';
             controlsDiv.innerHTML = controlsHtml; // The controls HTML itself is hardcoded safe string above
             div.appendChild(controlsDiv);
        }`;
        document.getElementById('monitor-messages').appendChild(div);
        document.getElementById('monitor-messages').scrollTop = document.getElementById('monitor-messages').scrollHeight;
    }
});

// Event Delegation for Monitor Actions (Fixes "function not defined" scope issues)
document.getElementById('monitor-messages').addEventListener('click', async (e) => {
    // Handle Delete
    const delBtn = e.target.closest('.action-btn-delete');
    if (delBtn) {
        const id = delBtn.dataset.id;
        if (confirm('Confirm Delete?')) {
            await authFetch('/api/admin/messages/delete', {
                method: 'POST',
                body: JSON.stringify({ messageId: id })
            });
        }
        return;
    }

    // Handle Pin
    const pinBtn = e.target.closest('.action-btn-pin');
    if (pinBtn) {
        const id = pinBtn.dataset.id;
        const text = decodeURIComponent(pinBtn.dataset.text); // Decode safe text

        await authFetch('/api/admin/messages/pin', {
            method: 'POST',
            body: JSON.stringify({ messageId: id, text, username: adminUsername })
        });
        alert('Message Pinned');
        return;
    }
});

// Sync Deletion
socket.on('message-deleted', (id) => {
    console.log('Socket received message-deleted for ID:', id);
    const el = document.getElementById(`msg-${id}`);
    if (el) {
        console.log('Element found, removing...');
        el.remove();
    } else {
        console.warn('Element not found to delete:', `msg-${id}`);
    }
});

// Config
document.getElementById('save-config-btn').addEventListener('click', async () => {
    const ttl = document.getElementById('config-ttl').value;
    const spam = document.getElementById('config-spam').value;

    await authFetch('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify({ ttl, spam })
    });
    alert('Config Saved');
});

// Update sliders
document.getElementById('config-ttl').oninput = (e) =>
    document.getElementById('ttl-val').innerText = e.target.value == 0 ? 'Never' : e.target.value + 's';
document.getElementById('config-spam').oninput = (e) =>
    document.getElementById('spam-val').innerText = e.target.value + 's';

// Mobile Menu Logic
const mobileMenuBtn = document.getElementById('admin-mobile-menu');
const sidebar = document.querySelector('.sidebar');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent immediate close
        sidebar.classList.toggle('active');

        // Toggle icon
        const icon = mobileMenuBtn.querySelector('i');
        if (sidebar.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('active') &&
        !sidebar.contains(e.target) &&
        e.target !== mobileMenuBtn) {

        sidebar.classList.remove('active');
        const icon = mobileMenuBtn.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});
