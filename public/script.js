const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const roomNameEl = document.getElementById('room-name');
const onlineCountEl = document.getElementById('online-count');
const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const msgInput = document.getElementById('msg');
const imageInput = document.getElementById('image-input');
const replyPreview = document.getElementById('reply-preview');
const replyText = document.getElementById('reply-text');
const replyCancelBtn = document.getElementById('reply-cancel');
const emojiPicker = document.getElementById('emoji-picker');

// Social Elements
const shareBtn = document.getElementById('share-btn');
const chatContainer = document.querySelector('.chat-container');

const socket = io();

let currentUsername = '';
let currentRoom = '';
let replyToId = null;
let replyToText = null;
let currentMessageIdForReaction = null;
let reactionEmojis = [];

// Get Config
async function getConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        reactionEmojis = config.reactionEmojis;
        populateEmojiPicker();
    } catch (err) { console.error(err); }
}

function populateEmojiPicker() {
    emojiPicker.innerHTML = '';
    reactionEmojis.forEach(emoji => {
        const span = document.createElement('span');
        span.innerText = emoji;
        span.addEventListener('click', () => {
            if (currentMessageIdForReaction) {
                socket.emit('addReaction', { messageId: currentMessageIdForReaction, emoji });
            }
            hideEmojiPicker();
        });
        emojiPicker.appendChild(span);
    });
}

// Fetch Rooms
async function fetchRooms() {
    try {
        const res = await fetch('/api/rooms');
        const rooms = await res.json();
        renderRooms(rooms);
    } catch (e) { console.error(e); }
}

function renderRooms(rooms) {
    // 1. Sidebar
    const sidebarList = document.getElementById('sidebar-room-list');
    if (sidebarList) {
        sidebarList.innerHTML = '';
        rooms.forEach((r) => {
            const li = document.createElement('li');
            li.className = 'room-item';
            if (r.name === currentRoom) li.classList.add('active');
            if (r.locked) li.classList.add('locked');

            const icon = r.locked ? '<i class="fas fa-lock" style="color:#ff6b6b"></i>' : '<i class="fas fa-hashtag"></i>';
            li.innerHTML = `${icon} <span>${r.name}</span>`;

            li.onclick = () => {
                if (r.locked && currentUsername !== 'AdminMonitor') {
                    showError(`Room Locked: ${r.reason}`);
                    return;
                }
                if (r.name !== currentRoom) switchRoom(r.name);
            };
            sidebarList.appendChild(li);
        });
    }

    // 2. Dropdown
    const select = document.getElementById('room');
    if (select) {
        const saved = select.value;
        select.innerHTML = '';
        rooms.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.name;
            opt.innerText = r.name + (r.locked ? ' (Locked)' : '');
            if (r.locked) opt.disabled = true;
            select.appendChild(opt);
        });
        if (saved) select.value = saved;
    }
}

// Join Room
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = e.target.elements.username.value;
    const room = e.target.elements.room.value;

    if (!room) return showError('Select a room');

    currentUsername = user;
    currentRoom = room;

    socket.emit('joinRoom', { username: user, room });

    joinScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    roomNameEl.innerText = room;

    document.querySelectorAll('.room-item').forEach(li => {
        if (li.innerText.includes(room)) li.classList.add('active');
    });
});

function switchRoom(newRoom) {
    chatMessages.innerHTML = '';
    currentRoom = newRoom;
    roomNameEl.innerText = newRoom;
    socket.emit('joinRoom', { username: currentUsername, room: newRoom });
    fetchRooms(); // Refresh UI state
}

// Socket Events
socket.on('rooms-updated', (rooms) => {
    if (Array.isArray(rooms)) renderRooms(rooms);
});

socket.on('roomUsers', ({ count }) => {
    onlineCountEl.innerText = count;
});

socket.on('message', (msg) => {
    outputMessage(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('message-pinned', ({ text, username }) => {
    document.getElementById('pinned-bar').style.display = 'flex';
    document.getElementById('pinned-author').innerText = username || 'Moderator';
    document.getElementById('pinned-text').innerText = text;
});

socket.on('message-unpinned', () => {
    document.getElementById('pinned-bar').style.display = 'none';
});

socket.on('room-locked', () => {
    showError('Room Locked');
    setTimeout(() => location.reload(), 2000);
});

socket.on('error-message', (msg) => showError(msg));

socket.on('reactionAdded', ({ messageId, reactions }) => {
    const el = document.querySelector(`.message[data-id="${messageId}"]`);
    if (el) updateReactions(el, reactions);
});

socket.on('message-expired', (id) => {
    const el = document.querySelector(`.message[data-id="${id}"]`);
    if (el) el.remove();
});

socket.on('message-deleted', (id) => {
    const el = document.querySelector(`.message[data-id="${id}"]`);
    if (el) {
        el.innerHTML = '<em style="color:#888;">Message deleted by moderator</em>';
        setTimeout(() => el.remove(), 2000);
    }
});


// Chat Form
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = msgInput.value;
    if (!text) return;

    socket.emit('chatMessage', { text, replyTo: replyToId, replyToText: replyToText });

    msgInput.value = '';
    msgInput.focus();
    clearReply();
});

// Output Message
function outputMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message';
    div.dataset.id = msg.id;

    // Classes
    if (msg.username === currentUsername) div.classList.add('my-message');
    if (msg.isAdmin) div.classList.add('admin-message');

    // Meta
    const meta = document.createElement('div');
    meta.className = 'meta';

    // REMOVED PROFILE PICTURE (User request 5)

    const name = document.createElement('span');
    name.className = 'username';
    name.innerText = msg.username;
    name.style.color = msg.color || '#fff';
    meta.appendChild(name);

    // Mod Badge (Checkmark) (User request 4)
    if (msg.isAdmin) {
        const badge = document.createElement('span');
        badge.innerHTML = '<i class="fas fa-check-circle"></i> MOD';
        badge.style.color = '#ffd700';
        badge.style.marginLeft = '5px';
        badge.style.fontSize = '0.8rem';
        meta.appendChild(badge);
    }

    const time = document.createElement('span');
    time.className = 'time';
    time.innerText = msg.time;
    meta.appendChild(time);

    div.appendChild(meta);

    // Reply
    if (msg.replyToText) {
        const rep = document.createElement('div');
        rep.className = 'reply-preview';
        rep.innerText = `Replying to: ${msg.replyToText}`;
        rep.style.fontSize = '0.8rem';
        div.appendChild(rep);
    }

    // Image
    if (msg.imageData) {
        const img = document.createElement('img');
        img.src = msg.imageData;
        img.className = 'message-image';
        div.appendChild(img);
    }

    // Text
    if (msg.text) {
        const p = document.createElement('p');
        p.className = 'text';
        p.innerText = msg.text;
        div.appendChild(p);
    }

    // Reactions
    const reacts = document.createElement('div');
    reacts.className = 'reactions';
    div.appendChild(reacts);
    if (msg.reactions) updateReactions(div, msg.reactions);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const repBtn = document.createElement('button');
    repBtn.className = 'action-btn';
    repBtn.innerHTML = '<i class="fas fa-reply"></i>';
    repBtn.onclick = () => {
        replyToId = msg.id;
        replyToText = msg.text || '[Image]';
        replyPreview.style.display = 'flex';
        replyText.innerText = `Replying: ${replyToText}`;
        msgInput.focus();
    };

    const reactBtn = document.createElement('button');
    reactBtn.className = 'action-btn';
    reactBtn.innerHTML = '<i class="far fa-smile"></i>';
    reactBtn.onclick = (e) => {
        currentMessageIdForReaction = msg.id;
        const rect = reactBtn.getBoundingClientRect();
        emojiPicker.style.display = 'flex';
        emojiPicker.style.top = (rect.top - 50) + 'px';
        emojiPicker.style.left = rect.left + 'px';
        e.stopPropagation();
    };

    actions.appendChild(repBtn);
    actions.appendChild(reactBtn);
    div.appendChild(actions);

    chatMessages.appendChild(div);
}

function updateReactions(el, reactions) {
    const c = el.querySelector('.reactions');
    if (!c) return;
    c.innerHTML = '';
    for (const [e, n] of Object.entries(reactions)) {
        const s = document.createElement('span');
        s.className = 'reaction-badge';
        s.innerText = `${e} ${n}`;
        s.onclick = () => socket.emit('addReaction', { messageId: el.dataset.id, emoji: e });
        c.appendChild(s);
    }
}

// Emoji Picker Logic
// Emoji Picker Logic (Consolidated)

// Close Picker on Outside Click
document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && !e.target.closest('.action-btn')) {
        emojiPicker.style.display = 'none';
        currentMessageIdForReaction = null;
    }
});

function showEmojiPicker(x, y, msgId) {
    currentMessageIdForReaction = msgId;
    emojiPicker.style.display = 'flex';

    // Boundary checks
    const rect = emojiPicker.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    if (x + 300 > winWidth) finalX = winWidth - 310;
    if (y + 50 > winHeight) finalY = y - 60; // Show above if near bottom

    emojiPicker.style.left = `${finalX}px`;
    emojiPicker.style.top = `${finalY}px`;
}
function showError(msg) {
    const d = document.createElement('div');
    d.style.position = 'fixed';
    d.style.top = '20px';
    d.style.left = '50%';
    d.style.transform = 'translateX(-50%)';
    d.style.background = '#ff4757';
    d.style.color = '#fff';
    d.style.padding = '10px 20px';
    d.style.zIndex = 10000;
    d.innerText = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3000);
}

function clearReply() {
    replyToId = null;
    replyToText = null;
    replyPreview.style.display = 'none';
}
replyCancelBtn.onclick = clearReply;

// Setup
fetchRooms();
getConfig();
document.getElementById('leave-btn').onclick = () => location.reload();
document.getElementById('close-pin').onclick = () => document.getElementById('pinned-bar').style.display = 'none';

// Image
imageInput.onchange = function () {
    if (this.files[0]) {
        const r = new FileReader();
        r.onload = (e) => {
            socket.emit('chatImage', { imageData: e.target.result, replyTo: replyToId, replyToText: replyToText });
            clearReply();
        };
        r.readAsDataURL(this.files[0]);
    }
    this.value = '';
};

// Close emoji
document.onclick = (e) => {
    if (!e.target.closest('.action-btn') && !emojiPicker.contains(e.target)) emojiPicker.style.display = 'none';
};

// Terms Modal Logic
const termsModal = document.getElementById('terms-modal');
const openTermsBtn = document.getElementById('open-terms');
const closeTermsBtn = document.getElementById('close-terms');
const acceptTermsBtn = document.getElementById('accept-terms');

if (openTermsBtn) {
    openTermsBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        termsModal.style.display = 'flex';
    };
}
if (closeTermsBtn) closeTermsBtn.onclick = () => termsModal.style.display = 'none';
if (acceptTermsBtn) acceptTermsBtn.onclick = () => termsModal.style.display = 'none';

// Close modal on outside click
window.onmousedown = (e) => {
    if (e.target === termsModal) termsModal.style.display = 'none';
};