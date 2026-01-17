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

// Social Share Elements
const shareBtn = document.getElementById('share-btn');
const chatContainer = document.querySelector('.chat-container');
const exportContainer = document.getElementById('export-container');
const exportMessages = document.getElementById('export-messages');
const shareModal = document.getElementById('share-modal');
const sharePreview = document.getElementById('share-preview');
const downloadLink = document.getElementById('download-link');
const closeModal = document.querySelector('.close-modal');

const socket = io();

let myColor = null;
let replyToId = null;
let replyToText = null;
let currentMessageIdForReaction = null;
let reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Selection Mode State
let isSelectionMode = false;
const selectedMessages = new Set();
let selectionControls = null;

// Selection Mode State - initialized above
// let isSelectionMode = false;
// const selectedMessages = new Set();

// Fetch config
async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        reactionEmojis = data.reactionEmojis || reactionEmojis;
        populateEmojiPicker();
    } catch (err) {
        console.error('Failed to fetch config', err);
    }
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

// Fetch rooms
async function fetchRooms() {
    try {
        const res = await fetch('/api/rooms');
        const data = await res.json();
        populateRoomSelect(data);
    } catch (err) {
        console.error('Failed to fetch rooms', err);
    }
}

function populateRoomSelect({ standard, trending }) {
    const roomSelect = document.getElementById('room');
    const currentVal = roomSelect.value;
    roomSelect.innerHTML = '';

    const stdGroup = document.createElement('optgroup');
    stdGroup.label = "Standard Rooms";
    standard.forEach(room => {
        const opt = document.createElement('option');
        opt.value = room;
        opt.innerText = room;
        stdGroup.appendChild(opt);
    });
    roomSelect.appendChild(stdGroup);

    if (trending && trending.length > 0) {
        const trendGroup = document.createElement('optgroup');
        trendGroup.label = "🔥 Viral Topics";
        trending.forEach(room => {
            const opt = document.createElement('option');
            opt.value = room;
            opt.innerText = room;
            trendGroup.appendChild(opt);
        });
        roomSelect.appendChild(trendGroup);
    }

    if (currentVal) roomSelect.value = currentVal;
}

// Initialize
fetchConfig();
fetchRooms();

socket.on('rooms-updated', populateRoomSelect);

// Join room
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = e.target.elements.username.value;
    const room = e.target.elements.room.value;
    if (!room) {
        alert("Please select a valid room!");
        return;
    }
    socket.emit('joinRoom', { username, room });
    joinScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
});

// Room info
socket.on('roomUsers', ({ room, count, userColor }) => {
    roomNameEl.innerText = room;
    onlineCountEl.innerHTML = `<i class="fas fa-circle"></i> ${count} online`;
    if (userColor) myColor = userColor;
});

// Receive message
socket.on('message', message => {
    outputMessage(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Message expired
socket.on('message-expired', (id) => {
    const msgEl = document.getElementById(`msg-${id}`);
    if (msgEl) {
        msgEl.classList.add('expired');
        setTimeout(() => msgEl.remove(), 500);
    }
});

// Reaction added
socket.on('reactionAdded', ({ messageId, reactions }) => {
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (msgEl) {
        updateReactions(msgEl, reactions);
    }
});

// Error message
socket.on('error-message', (text) => {
    showError(text);
});

// Send text message
chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (text) {
        socket.emit('chatMessage', { text, replyTo: replyToId, replyToText: replyToText });
        msgInput.value = '';
        clearReply();
    }
    msgInput.focus();
});

// Send image
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showError('Image too large. Max 2MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        socket.emit('chatImage', { imageData: reader.result, replyTo: replyToId, replyToText: replyToText });
        clearReply();
    };
    reader.readAsDataURL(file);
    imageInput.value = '';
});

// Output message
function outputMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.id = `msg-${message.id}`;
    div.dataset.id = message.id;

    // System message styling
    if (message.username === 'System') {
        div.classList.add('system');
        div.innerHTML = `<p class="text">${message.text}</p>`;
        chatMessages.appendChild(div);
        return;
    }

    // Set border color
    div.style.borderLeftColor = message.color || '#7289da';

    let html = '';

    // Reply quote - use replyToText sent from server
    if (message.replyTo && message.replyToText) {
        const text = message.replyToText;
        html += `<div class="reply-quote">↩ ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}</div>`;
    }

    // Meta (username + color dot + time)
    html += `<div class="meta">
        <span class="color-dot" style="background: ${message.color || '#7289da'}"></span>
        <span class="username" style="color: ${message.color || '#7289da'}">${escapeHtml(message.username)}</span>
        <span class="time">${message.time}</span>
    </div>`;

    // Content
    if (message.imageData) {
        html += `<img src="${message.imageData}" class="image-content" alt="shared image" />`;
    } else {
        html += `<p class="text">${escapeHtml(message.text)}</p>`;
    }

    // Reactions container
    html += `<div class="reactions" id="reactions-${message.id}"></div>`;

    // Actions (Reply, React)
    html += `<div class="message-actions">
        <button class="action-btn reply-btn" title="Reply"><i class="fas fa-reply"></i></button>
        <button class="action-btn react-btn" title="React"><i class="fas fa-smile"></i></button>
    </div>`;

    div.innerHTML = html;

    // Add event listeners (standard mode)
    const replyBtn = div.querySelector('.reply-btn');
    const reactBtn = div.querySelector('.react-btn');

    replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setReply(message);
    });
    reactBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEmojiPicker(e, message.id);
    });

    // Selection Mode Click Handler
    div.addEventListener('click', (e) => {
        if (isSelectionMode) {
            e.preventDefault();
            toggleSelection(div, message.id);
        }
    });

    // Long-press to toggle selection mode (if not already active)
    let pressTimer;
    div.addEventListener('touchstart', (e) => {
        // Only if not replying or reacting
        if (e.target.closest('.action-btn')) return;

        pressTimer = setTimeout(() => {
            if (!isSelectionMode) {
                enterSelectionMode();
                toggleSelection(div, message.id);
            }
        }, 500);
    });
    div.addEventListener('touchend', () => clearTimeout(pressTimer));

    // Also support right click for selection on desktop for ease
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!isSelectionMode) {
            enterSelectionMode();
            toggleSelection(div, message.id);
        }
    });

    chatMessages.appendChild(div);

    // Initialize reactions
    if (message.reactions && Object.keys(message.reactions).length > 0) {
        updateReactions(div, message.reactions);
    }
}

function updateReactions(msgEl, reactions) {
    const container = msgEl.querySelector('.reactions');
    if (!container) return;
    container.innerHTML = '';
    for (const [emoji, count] of Object.entries(reactions)) {
        const badge = document.createElement('span');
        badge.className = 'reaction-badge';
        badge.innerText = `${emoji} ${count}`;
        badge.addEventListener('click', (e) => {
            // If in selection mode, bubble up to select message
            if (isSelectionMode) return;
            e.stopPropagation();
            socket.emit('addReaction', { messageId: msgEl.dataset.id, emoji });
        });
        container.appendChild(badge);
    }
}

function setReply(message) {
    if (isSelectionMode) return;
    replyToId = message.id;
    replyToText = message.text || '[Image]';
    replyText.innerText = `Replying: ${replyToText.substring(0, 40)}${replyToText.length > 40 ? '...' : ''}`;
    replyPreview.style.display = 'flex';
    msgInput.focus();
}

function clearReply() {
    replyToId = null;
    replyToText = null;
    replyPreview.style.display = 'none';
}

replyCancelBtn.addEventListener('click', clearReply);

// Emoji picker
function showEmojiPicker(e, messageId) {
    e.preventDefault();
    if (isSelectionMode) return;

    currentMessageIdForReaction = messageId;

    // Position near the button that was clicked
    const rect = e.target.closest('.react-btn').getBoundingClientRect();
    emojiPicker.style.display = 'flex';
    emojiPicker.style.left = `${rect.left}px`;
    emojiPicker.style.top = `${rect.top - 50}px`;
}

function hideEmojiPicker() {
    emojiPicker.style.display = 'none';
    currentMessageIdForReaction = null;
}

document.addEventListener('click', (e) => {
    // Don't close if clicking on react button or inside picker
    if (e.target.closest('.react-btn')) return;
    if (emojiPicker.contains(e.target)) return;
    hideEmojiPicker();
});

// --- Phase 4: Social Share Logic ---

// Bind actions statically
shareBtn.addEventListener('click', enterSelectionMode);
document.getElementById('cancel-share-btn').addEventListener('click', exitSelectionMode);
document.getElementById('generate-share-btn').addEventListener('click', generateImage);

function enterSelectionMode() {
    if (isSelectionMode) return;
    isSelectionMode = true;
    chatContainer.classList.add('selection-mode');
}

function exitSelectionMode() {
    isSelectionMode = false;
    chatContainer.classList.remove('selection-mode');
    selectedMessages.clear();

    // Remove selections
    document.querySelectorAll('.message.selected-msg').forEach(el => el.classList.remove('selected-msg'));
}

function toggleSelection(el, id) {
    if (selectedMessages.has(id)) {
        selectedMessages.delete(id);
        el.classList.remove('selected-msg');
    } else {
        selectedMessages.add(id);
        el.classList.add('selected-msg');
    }
}

async function generateImage() {
    console.log('generateImage called, selections:', selectedMessages.size);

    if (selectedMessages.size === 0) {
        alert("Select at least one message!");
        return;
    }

    // Show loading feedback
    const generateBtn = document.getElementById('generate-share-btn');
    const originalText = generateBtn.innerText;
    generateBtn.innerText = 'Loading...';
    generateBtn.disabled = true;

    // Clear export container
    exportMessages.innerHTML = '';

    // Get selected messages in order (by DOM order)
    const allMessages = Array.from(chatMessages.children);
    console.log('Total messages:', allMessages.length);

    allMessages.forEach(msgEl => {
        if (selectedMessages.has(msgEl.dataset.id)) {
            console.log('Adding message:', msgEl.dataset.id);
            const clone = msgEl.cloneNode(true);

            // Remove actions
            const actions = clone.querySelector('.message-actions');
            if (actions) actions.remove();

            // Remove selected styling
            clone.classList.remove('selected-msg');

            // --- FORCE STYLES (Fix for invisible text) ---
            clone.style.backgroundColor = '#FFFFFF';
            clone.style.border = '1px solid #E5E7EB';
            clone.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            clone.style.borderRadius = '12px';
            clone.style.marginBottom = '10px';
            clone.style.color = '#000000'; // Fallback

            const textEl = clone.querySelector('.text');
            if (textEl) {
                textEl.style.setProperty('color', '#000000', 'important');
                textEl.style.fontSize = '16px';
                textEl.style.fontWeight = '500';
            }

            const nameEl = clone.querySelector('.username');
            if (nameEl) {
                nameEl.style.setProperty('color', '#111827', 'important');
                nameEl.style.fontWeight = '700';
            }

            const timeEl = clone.querySelector('.time');
            if (timeEl) {
                timeEl.style.color = '#6B7280';
            }

            const metaEl = clone.querySelector('.meta');
            if (metaEl) {
                metaEl.style.color = '#6B7280';
            }
            // ---------------------------------------------

            exportMessages.appendChild(clone);
        }
    });

    console.log('Export messages count:', exportMessages.children.length);

    // Render with html2canvas via CDN
    try {
        console.log('Calling html2canvas...');
        const canvas = await html2canvas(exportContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: true
        });

        const imgUrl = canvas.toDataURL("image/png");

        // Show Modal
        const img = document.createElement('img');
        img.src = imgUrl;
        sharePreview.innerHTML = '';
        sharePreview.appendChild(img);

        downloadLink.href = imgUrl;
        shareModal.style.display = 'flex';

        exitSelectionMode();
    } catch (err) {
        console.error("Image generation failed", err);
        alert("Failed to generate image: " + err.message);
    } finally {
        // Reset button
        generateBtn.innerText = originalText;
        generateBtn.disabled = false;
    }
}

// Modal Close
closeModal.addEventListener('click', () => {
    shareModal.style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target == shareModal) {
        shareModal.style.display = 'none';
    }
});

// Error toast
function showError(text) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerText = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

// Leave button
document.getElementById('leave-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Leave the chatroom?')) {
        window.location.reload();
    }
});
