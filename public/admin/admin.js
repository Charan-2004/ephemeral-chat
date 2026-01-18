const socket = io();
const loginForm = document.getElementById('admin-login-form');
const loginScreen = document.getElementById('admin-login-screen');
const dashboard = document.getElementById('admin-dashboard');

let adminToken = localStorage.getItem('adminToken');
let adminUsername = localStorage.getItem('adminUsername') || 'Moderator';
let currentMonitorRoom = '';

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
    const res = await fetch('/api/admin/stats', { headers: { 'Authorization': adminToken } });
    const data = await res.json();
    document.getElementById('stat-users').innerText = data.users;
    document.getElementById('stat-rooms').innerText = data.activeRooms;
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

        li.innerHTML = `
            <span>${r.name} ${r.locked ? '<span style="color:red">[LOCKED]</span>' : ''}</span>
            <div>
                 <button onclick="toggleLock('${r.name}', '${r.locked ? 'unlock' : 'lock'}')">
                    ${r.locked ? 'Unlock' : 'Lock'}
                 </button>
                 <button onclick="deleteRoom('${r.name}')" style="background:red; color:white;">Delete</button>
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
            <strong>${msg.username}</strong>: ${displayContent}
            ${controlsHtml}
        `;
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
            try {
                await fetch('/api/admin/messages/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
                    body: JSON.stringify({ messageId: id })
                });
            } catch (error) { console.error('Delete failed:', error); }
        }
        return;
    }

    // Handle Pin
    const pinBtn = e.target.closest('.action-btn-pin');
    if (pinBtn) {
        const id = pinBtn.dataset.id;
        const text = decodeURIComponent(pinBtn.dataset.text); // Decode safe text

        try {
            await fetch('/api/admin/messages/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
                body: JSON.stringify({ messageId: id, text, username: adminUsername })
            });
            alert('Message Pinned');
        } catch (error) { console.error('Pin failed:', error); }
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

// Global functions for inline onclick
window.toggleLock = async (room, action) => {
    const reason = action === 'lock' ? prompt('Reason?') : '';
    await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
        body: JSON.stringify({ action, roomName: room, reason })
    });
    loadRooms();
};

window.deleteRoom = async (room) => {
    if (!confirm('Delete?')) return;
    await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
        body: JSON.stringify({ action: 'delete', roomName: room })
    });
    loadRooms();
};

// (Window.deleteMessage and window.pinMessage removed - replaced by Event Delegation)

window.unpinMessage = async () => {
    try {
        await fetch('/api/admin/messages/unpin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': adminToken }
        });
        alert('Unpinned!');
    } catch (e) { console.error(e); }
};


// Config
document.getElementById('save-config-btn').addEventListener('click', async () => {
    const ttl = document.getElementById('config-ttl').value;
    const spam = document.getElementById('config-spam').value;

    await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
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
