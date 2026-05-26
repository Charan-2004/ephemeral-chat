const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const roomNameEl = document.getElementById('room-name');
const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');

// Onboarding dynamic tabs state
let activeTab = 'general';
let selectedRoomType = 'public';

// Tab click binding
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');

        // Hide all sections, show active section
        document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));
        const activeSec = document.getElementById(`tab-section-${activeTab}`);
        if (activeSec) activeSec.classList.add('active');
    };
});

// Room Type Toggle click binding (Public / Private)
document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRoomType = btn.getAttribute('data-type');

        const passField = document.querySelector('.private-only');
        if (passField) {
            passField.style.display = selectedRoomType === 'private' ? 'block' : 'none';
        }
    };
});
const msgInput = document.getElementById('msg');
const imageInput = document.getElementById('image-input');
const replyPreview = document.getElementById('reply-preview');
const replyText = document.getElementById('reply-text');
const replyCancelBtn = document.getElementById('reply-cancel');
const emojiPicker = document.getElementById('emoji-picker');

// Social Elements
const shareBtn = document.getElementById('share-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.chat-sidebar');
const chatContainer = document.querySelector('.chat-container');

// Mobile Menu Toggle
if (mobileMenuBtn) {
    mobileMenuBtn.onclick = () => {
        sidebar.classList.toggle('active');
    };
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('active') &&
        !sidebar.contains(e.target) &&
        e.target !== mobileMenuBtn &&
        !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

const socket = io();

let currentUsername = '';
let currentRoom = '';
let replyToId = null;
let replyToText = null;
let currentMessageIdForReaction = null;
let reactionEmojis = [];
let isTabFocused = true;
let typingTimeout = null;
let unreadCounts = {};
let roomCounts = {};

// Mentions and Autocomplete State
let activeUsers = [];
let filteredMentionUsers = [];
let selectedMentionIndex = -1;
let isMentionActive = false;
let mentionSearchQuery = '';
let mentionStartIdx = -1;

const usernameDisplay = document.getElementById('username-display');
const usernameInput = document.getElementById('username');
const regenerateBtn = document.getElementById('regenerate-username-btn');

const ADJECTIVES = ['Silent', 'Mystic', 'Crimson', 'Golden', 'Shadow', 'Radiant', 'Frosty', 'Wild', 'Cosmic', 'Swift', 'Lone', 'Vibrant', 'Serene', 'Ember', 'Stealthy', 'Noble', 'Ancient', 'Wandering', 'Bold', 'Chilled'];
const NOUNS = ['Wolf', 'Falcon', 'Tiger', 'Panda', 'Eagle', 'Fox', 'Dragon', 'Phoenix', 'Raven', 'Lion', 'Leopard', 'Hawk', 'Badger', 'Coyote', 'Bear', 'Jaguar', 'Viper', 'Owl', 'Dolphin', 'Stag'];

function generateRandomUsername() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${adj}${noun}${num}`;
}

function setUsername(name) {
    if (usernameDisplay) usernameDisplay.textContent = name;
    if (usernameInput) usernameInput.value = name;
    localStorage.setItem('chathere_username', name);
}

(function initUsername() {
    let savedName = localStorage.getItem('chathere_username');
    if (!savedName) {
        savedName = generateRandomUsername();
    }
    setUsername(savedName);

    // Deep link: auto-select room from URL param ?room=Gaming
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        localStorage.setItem('chathere_room', roomParam);
    }
})();

if (regenerateBtn) {
    regenerateBtn.onclick = () => {
        setUsername(generateRandomUsername());
    };
}

// Tab focus tracking
window.addEventListener('focus', () => { isTabFocused = true; });
window.addEventListener('blur', () => { isTabFocused = false; });

// Notification sound (generated tone)
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
}

// Premium synthesizer double beep sound for mentions
function playMentionSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.12, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        const now = ctx.currentTime;
        playBeep(987.77, now, 0.08); // First beep (B5)
        playBeep(1318.51, now + 0.1, 0.15); // Second beep (E6) - 100ms later
    } catch (e) {}
}

// (Online count polling removed — replaced by Active Rooms)

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
            const count = roomCounts[r.name] || 0;
            const unread = unreadCounts[r.name] || 0;
            let badge = '';
            if (unread > 0 && r.name !== currentRoom) {
                badge = `<span class="unread-badge">${unread}</span>`;
            } else {
                badge = `<span class="room-count">${count}</span>`;
            }
            li.innerHTML = `${icon} <span>${r.name}</span>${badge}`;

            li.onclick = () => {
                if (r.locked && currentUsername !== 'AdminMonitor') {
                    showError(`Room Locked: ${r.reason}`);
                    return;
                }
                if (r.name !== currentRoom) {
                    switchRoom(r.name);
                    if (window.innerWidth <= 768) {
                        document.querySelector('.chat-sidebar').classList.remove('active');
                    }
                }
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
        // Priority: URL param > localStorage > first available
        const urlRoom = new URLSearchParams(window.location.search).get('room');
        const savedRoom = localStorage.getItem('chathere_room');
        const targetRoom = urlRoom || savedRoom || saved;
        if (targetRoom && select.querySelector(`option[value="${targetRoom}"]`)) {
            select.value = targetRoom;
        } else if (saved) {
            select.value = saved;
        }
    }

    // 3. Active Rooms on onboarding page
    renderActiveRooms(rooms);
}



// Render Active Rooms on onboarding page

// ============================================================
// ONBOARDING SCREEN VIEW NAVIGATION & LOGIC
// ============================================================

// Switch views with smooth styling
function showView(viewId) {
    const views = document.querySelectorAll('.onboarding-view');
    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });
    
    const target = document.getElementById(viewId);
    if (target) {
        target.style.display = 'flex';
        // Delay to allow display block layout before applying transition
        setTimeout(() => {
            target.classList.add('active');
        }, 10);
        
        // Smooth scroll to wrapper center
        const wrapper = document.querySelector('.join-form-wrapper');
        if (wrapper) {
            wrapper.style.minHeight = 'auto';
        }
    }
}

// Set up UI triggers and event handlers on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const btnShowBrowse = document.getElementById('btn-show-browse');
    const btnShowCustom = document.getElementById('btn-show-custom');
    const backFromBrowse = document.getElementById('back-to-selection-from-browse');
    const backFromCustom = document.getElementById('back-to-selection-from-custom');
    const roomsSearchInput = document.getElementById('rooms-search-input');
    const termsCheckSelection = document.getElementById('terms-check-selection');
    const termsCheckCustom = document.getElementById('terms-check');

    if (btnShowBrowse) {
        btnShowBrowse.addEventListener('click', () => {
            // Check terms check status from selection page first
            if (termsCheckSelection && !termsCheckSelection.checked) {
                showError('Please agree to the Terms & Conditions first');
                termsCheckSelection.focus();
                return;
            }
            showView('onboarding-browse-view');
        });
    }

    if (btnShowCustom) {
        btnShowCustom.addEventListener('click', () => {
            showView('onboarding-custom-view');
        });
    }

    if (backFromBrowse) {
        backFromBrowse.addEventListener('click', () => {
            showView('onboarding-selection-view');
        });
    }

    if (backFromCustom) {
        backFromCustom.addEventListener('click', () => {
            showView('onboarding-selection-view');
        });
    }

    // Bidirectional Terms & Conditions Sync
    if (termsCheckSelection && termsCheckCustom) {
        termsCheckSelection.addEventListener('change', () => {
            termsCheckCustom.checked = termsCheckSelection.checked;
        });
        termsCheckCustom.addEventListener('change', () => {
            termsCheckSelection.checked = termsCheckSelection.checked;
        });
    }

    // Search Filtering Trigger
    if (roomsSearchInput) {
        roomsSearchInput.addEventListener('input', () => {
            fetchRooms(); // Refetches rooms and triggers live re-rendering/filtering
        });
    }
});

// Render Active Rooms on onboarding page
function renderActiveRooms(rooms) {
    const grid = document.getElementById('active-rooms-grid');
    if (!grid) return;

    // Filter to public rooms only (already filtered from server, but be safe)
    const publicRooms = rooms.filter(r => !r.isPrivate);

    // Sort rooms dynamically by live user count in descending order
    publicRooms.sort((a, b) => {
        const countA = a.userCount || roomCounts[a.id] || roomCounts[a.name] || 0;
        const countB = b.userCount || roomCounts[b.id] || roomCounts[b.name] || 0;
        return countB - countA;
    });

    // Check search filter query
    const searchQuery = (document.getElementById('rooms-search-input')?.value || '').toLowerCase().trim();
    const filteredRooms = publicRooms.filter(r => r.name.toLowerCase().includes(searchQuery));

    // Check if any room matches
    if (filteredRooms.length === 0) {
        if (searchQuery) {
            grid.innerHTML = `
                <div class="active-rooms-empty">
                    <i class="fas fa-search"></i>
                    <span>No public rooms match "${searchQuery}" — try creating one!</span>
                </div>`;
        } else {
            grid.innerHTML = `
                <div class="active-rooms-empty">
                    <i class="fas fa-moon"></i>
                    <span>All rooms are quiet — be the first to start a conversation!</span>
                </div>`;
        }
        return;
    }

    grid.innerHTML = '';
    filteredRooms.forEach(r => {
        const count = r.userCount || roomCounts[r.id] || roomCounts[r.name] || 0;
        const card = document.createElement('div');
        card.className = 'active-room-card' + (count > 0 ? ' has-users' : '');

        const icon = r.isCustom ? 'fa-comments' : 'fa-hashtag';
        const pulseHtml = count > 0 ? '<span class="room-pulse-dot"></span>' : '';

        card.innerHTML = `
            <div class="room-card-header">
                <i class="fas ${icon} room-card-icon"></i>
                <span class="room-card-name">${r.name}</span>
            </div>
            <div class="room-card-stats">
                ${pulseHtml}
                <span class="room-card-count">${count} ${count === 1 ? 'chatter' : 'chatters'}</span>
            </div>
            <button class="room-card-join-btn" data-room="${r.id || r.name}" data-room-name="${r.name}">
                <i class="fas fa-sign-in-alt"></i> Join
            </button>`;

        // Instant join handler
        const joinBtn = card.querySelector('.room-card-join-btn');
        joinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            instantJoinRoom(r.id || r.name, r.name);
        });

        grid.appendChild(card);
    });
}

// Instant join from Active Rooms card
function instantJoinRoom(roomId, roomName) {
    // Check terms (either checkbox)
    const termsCheck = document.getElementById('terms-check') || document.getElementById('terms-check-selection');
    if (termsCheck && !termsCheck.checked) {
        // Auto-check and scroll to terms for visibility
        termsCheck.focus();
        showError('Please agree to the Terms & Conditions first');
        showView('onboarding-selection-view');
        const checkWrapper = termsCheck.closest('.terms-checkbox');
        if (checkWrapper) checkWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Get username
    const user = document.getElementById('username')?.value || document.getElementById('username-display')?.innerText;
    if (!user || user === 'Generating...') {
        showError('Please wait for your alias to generate');
        return;
    }

    // Save and join
    localStorage.setItem('chathere_username', user);
    localStorage.setItem('chathere_room', roomId);
    currentUsername = user;
    currentRoom = roomId;

    socket.emit('joinRoom', { username: user, room: roomId });
    enterChatRoom(roomName || roomId);
}
