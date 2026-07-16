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
const docInput = document.getElementById('doc-input');
const replyPreview = document.getElementById('reply-preview');
const replyText = document.getElementById('reply-text');
const replyCancelBtn = document.getElementById('reply-cancel');

// Whisper Elements
const whisperPreview = document.getElementById('whisper-preview');
const whisperText = document.getElementById('whisper-text');
const whisperCancelBtn = document.getElementById('whisper-cancel');
let activeWhisperRecipient = null;
let inviteTarget = null;

const usernameContextMenu = document.getElementById('username-context-menu');
const contextWhisperBtn = document.getElementById('context-whisper');
const contextInviteBtn = document.getElementById('context-invite');

function clearWhisper() {
    activeWhisperRecipient = null;
    if (whisperPreview) whisperPreview.style.display = 'none';
}
if (whisperCancelBtn) {
    whisperCancelBtn.onclick = clearWhisper;
}

if (contextWhisperBtn) {
    contextWhisperBtn.onclick = (e) => {
        e.stopPropagation();
        const targetUserId = usernameContextMenu.dataset.targetUserId;
        const targetUsername = usernameContextMenu.dataset.targetUsername;
        if (targetUserId && targetUsername) {
            activeWhisperRecipient = { userId: targetUserId, username: targetUsername };
            whisperText.innerHTML = `<i class="fas fa-user-secret"></i> Whispering to <strong>@${targetUsername}</strong>`;
            whisperPreview.style.display = 'flex';
            clearReply();
            msgInput.focus();
        }
        usernameContextMenu.style.display = 'none';
    };
}

if (contextInviteBtn) {
    contextInviteBtn.onclick = (e) => {
        e.stopPropagation();
        const targetUserId = usernameContextMenu.dataset.targetUserId;
        const targetUsername = usernameContextMenu.dataset.targetUsername;
        if (targetUserId && targetUsername) {
            const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
            inviteTarget = { userId: targetUserId, username: targetUsername, password: tempPassword };
            socket.emit('createRoom', {
                roomName: `Chat w/ ${targetUsername}`,
                isPrivate: true,
                password: tempPassword
            });
        }
        usernameContextMenu.style.display = 'none';
    };
}

// Global click event to close context menu
window.addEventListener('click', () => {
    if (usernameContextMenu) usernameContextMenu.style.display = 'none';
});
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

let currentUserId = localStorage.getItem('chathere_userId');
if (!currentUserId) {
    currentUserId = 'usr_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('chathere_userId', currentUserId);
}
let currentUsername = '';
let currentRoom = '';
let isCurrentRoomPrivate = false;
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

// Users list selectors
const usersListBtn = document.getElementById('users-list-btn');
const usersListPanel = document.getElementById('users-list-panel');
const usersListCount = document.getElementById('users-list-count');
const usersListContent = document.getElementById('users-list-content');

const ADJECTIVES = ['Silent', 'Mystic', 'Crimson', 'Golden', 'Shadow', 'Radiant', 'Frosty', 'Wild', 'Cosmic', 'Swift', 'Lone', 'Vibrant', 'Serene', 'Ember', 'Stealthy', 'Noble', 'Ancient', 'Wandering', 'Bold', 'Chilled'];
const NOUNS = ['Wolf', 'Falcon', 'Tiger', 'Panda', 'Eagle', 'Fox', 'Dragon', 'Phoenix', 'Raven', 'Lion', 'Leopard', 'Hawk', 'Badger', 'Coyote', 'Bear', 'Jaguar', 'Viper', 'Owl', 'Dolphin', 'Stag'];

function generateRandomUsername() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${adj}${noun}${num}`;
}

function setUsername(name) {
    const textEl = document.getElementById('username-text');
    if (textEl) {
        textEl.textContent = name;
    } else if (usernameDisplay) {
        usernameDisplay.textContent = name;
    }
    if (usernameInput) usernameInput.value = name;
    const editInputEl = document.getElementById('username-edit-input');
    if (editInputEl) editInputEl.value = name;
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
        const editInputEl = document.getElementById('username-edit-input');
        if (editInputEl) editInputEl.style.display = 'none';
        if (usernameDisplay) usernameDisplay.style.display = 'inline-flex';
    };
}

if (usernameDisplay) {
    usernameDisplay.onclick = () => {
        const editInputEl = document.getElementById('username-edit-input');
        if (editInputEl) {
            usernameDisplay.style.display = 'none';
            editInputEl.style.display = 'block';
            editInputEl.focus();
            editInputEl.select();
        }
    };
}

const editInputEl = document.getElementById('username-edit-input');
if (editInputEl) {
    const saveUsernameEdit = () => {
        const val = editInputEl.value.trim();
        if (!val) {
            showError('Username cannot be empty');
            editInputEl.focus();
            return;
        }
        if (val.length > 20) {
            showError('Username must be 20 characters or less');
            editInputEl.focus();
            return;
        }
        setUsername(val);
        editInputEl.style.display = 'none';
        if (usernameDisplay) usernameDisplay.style.display = 'inline-flex';
    };

    const cancelUsernameEdit = () => {
        editInputEl.value = usernameInput.value;
        editInputEl.style.display = 'none';
        if (usernameDisplay) usernameDisplay.style.display = 'inline-flex';
    };

    editInputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveUsernameEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelUsernameEdit();
        }
    };

    editInputEl.onblur = () => {
        setTimeout(() => {
            if (editInputEl.style.display === 'block') {
                saveUsernameEdit();
            }
        }, 150);
    };
}

// Tab focus tracking
window.addEventListener('focus', () => { isTabFocused = true; });
window.addEventListener('blur', () => { isTabFocused = false; });

// Notification sound (generated tone)
let _sharedAudioCtx = null;
function _getAudioCtx() {
    try {
        if (!_sharedAudioCtx) {
            _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (_sharedAudioCtx.state === 'suspended') {
            _sharedAudioCtx.resume();
        }
        return _sharedAudioCtx;
    } catch (e) {
        return null;
    }
}

function playNotificationSound() {
    try {
        const ctx = _getAudioCtx();
        if (!ctx) return;
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
        const ctx = _getAudioCtx();
        if (!ctx) return;
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

// (Online count polling removed â€” replaced by Active Rooms)

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
let cachedRooms = [];
async function fetchRooms() {
    try {
        const res = await fetch('/api/rooms');
        cachedRooms = await res.json();
        renderRooms(cachedRooms);
    } catch (e) { console.error(e); }
}

function renderRooms(rooms) {
    // 1. Sidebar
    const sidebarList = document.getElementById('sidebar-room-list');
    if (sidebarList) {
        sidebarList.innerHTML = '';
        // Determine hot room: highest user count among unlocked public rooms
        const hotRoomName = (() => {
            let maxCount = 0, hotName = null;
            rooms.forEach(r => {
                if (r.locked || r.isPrivate) return;
                const c = roomCounts[r.name] || 0;
                if (c > maxCount) { maxCount = c; hotName = r.name; }
            });
            return maxCount > 0 ? hotName : null;
        })();

        rooms.forEach((r) => {
            const li = document.createElement('li');
            li.className = 'room-item';
            if (r.name === currentRoom) li.classList.add('active');
            if (r.locked) li.classList.add('locked');
            const isHot = !r.locked && !r.isPrivate && r.name === hotRoomName;
            if (isHot) li.classList.add('hot-room');

            const icon = r.locked ? '<i class="fas fa-lock" style="color:#ff6b6b"></i>' : (isHot ? '<span class="hot-fire">🔥</span>' : '<i class="fas fa-hashtag"></i>');
            const count = roomCounts[r.name] || 0;
            const unread = unreadCounts[r.name] || 0;
            let badge = '';
            if (unread > 0 && r.name !== currentRoom) {
                badge = `<span class="unread-badge">${unread}</span>`;
            } else if (isHot && !unread) {
                badge = `<span class="hot-badge" style="margin-left:auto;">HOT</span>`;
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
// Onboarding navigation and transitions
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
        
        // Hide alias form group in rooms browser view to save space
        const aliasGroup = document.getElementById('alias-form-group');
        if (aliasGroup) {
            aliasGroup.style.display = (viewId === 'onboarding-browse-view') ? 'none' : 'flex';
        }

        const wrapper = document.querySelector('.join-form-wrapper');
        if (wrapper) {
            wrapper.style.minHeight = 'auto';
        }
    }
}

// Set up UI triggers and event handlers on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const btnBrowseInline = document.getElementById('btn-browse-active-inline');
    const backFromBrowse = document.getElementById('back-to-selection-from-browse');
    const roomsSearchInput = document.getElementById('rooms-search-input');
    const termsCheck = document.getElementById('terms-check');

    if (btnBrowseInline) {
        btnBrowseInline.addEventListener('click', () => {
            // Validate terms before taking user to the rooms browser
            if (termsCheck && !termsCheck.checked) {
                showError('Please agree to the Terms & Conditions first');
                termsCheck.focus();
                return;
            }
            showView('onboarding-browse-view');
        });
    }

    if (backFromBrowse) {
        backFromBrowse.addEventListener('click', () => {
            showView('onboarding-custom-view');
        });
    }

    // Live search text filtering trigger with debouncing
    let searchDebounceTimer = null;
    if (roomsSearchInput) {
        roomsSearchInput.addEventListener('input', () => {
            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                fetchRooms(); // refetch and trigger re-render
            }, 300);
        });
    }

    // Auto-join if room parameter is present in URL query
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const passwordParam = urlParams.get('password');
    if (roomParam) {
        const termsCheck = document.getElementById('terms-check');
        if (termsCheck) termsCheck.checked = true;
        
        setTimeout(() => {
            const user = usernameInput.value || usernameDisplay.innerText || generateRandomUsername();
            setUsername(user);
            currentUsername = user;
            currentRoom = roomParam;
            
            socket.emit('joinRoom', {
                username: user,
                room: roomParam,
                password: passwordParam || null,
                userId: currentUserId
            });
            enterChatRoom(roomParam, roomParam, passwordParam);
        }, 400); // 400ms delay to allow socket to fully connect
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
                    <span>No public rooms match "${searchQuery}" â€” try creating one!</span>
                </div>`;
        } else {
            grid.innerHTML = `
                <div class="active-rooms-empty">
                    <i class="fas fa-moon"></i>
                    <span>All rooms are quiet â€” be the first to start a conversation!</span>
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
    // Check terms checkbox
    const termsCheck = document.getElementById('terms-check');
    if (termsCheck && !termsCheck.checked) {
        // Auto-check and scroll to terms for visibility
        termsCheck.focus();
        showError('Please agree to the Terms & Conditions first');
        showView('onboarding-custom-view');
        const checkWrapper = termsCheck.closest('.terms-checkbox');
        if (checkWrapper) checkWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Get username
    const user = document.getElementById('username').value || document.getElementById('username-display').innerText;
    if (!user || user === 'Generating...') {
        showError('Please wait for your alias to generate');
        return;
    }

    // Save and join
    localStorage.setItem('chathere_username', user);
    localStorage.setItem('chathere_room', roomId);
    currentUsername = user;
    currentRoom = roomId;

    socket.emit('joinRoom', { username: user, room: roomId, userId: currentUserId });
    enterChatRoom(roomName || roomId);
}

// Join Room
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const termsCheck = document.getElementById('terms-check');
    if (termsCheck && !termsCheck.checked) {
        return showError('You must agree to the Terms & Conditions to join');
    }

    const user = e.target.elements.username.value || document.getElementById('username-display').innerText;
    
    // Save to localStorage for returning users
    localStorage.setItem('chathere_username', user);
    currentUsername = user;

    if (activeTab === 'general') {
        const room = e.target.elements.room.value;
        if (!room) return showError('Select a room');
        
        localStorage.setItem('chathere_room', room);
        currentRoom = room;
        
        socket.emit('joinRoom', { username: user, room, userId: currentUserId });
        enterChatRoom(room);
    } 
    else if (activeTab === 'create') {
        const roomName = document.getElementById('create-room-name').value;
        const password = document.getElementById('create-room-password').value;
        
        const isPrivate = selectedRoomType === 'private';
        if (isPrivate && !password) {
            return showError('Password is required for private rooms');
        }
        
        // Emit room creation event
        socket.emit('createRoom', { roomName, isPrivate, password });
    } 
    else if (activeTab === 'join') {
        const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
        const password = document.getElementById('join-room-password').value;
        
        if (!roomId || roomId.length !== 8) {
            return showError('Room ID must be exactly 8 characters');
        }
        
        currentRoom = roomId;
        socket.emit('joinRoom', { username: user, room: roomId, password, userId: currentUserId });
        enterChatRoom(roomId, roomId, password);
    }
});

function enterChatRoom(roomName, roomId, password) {
    joinScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    
    // Reset users panel state on enter
    if (usersListBtn) usersListBtn.style.display = 'none';
    if (usersListPanel) usersListPanel.style.display = 'none';
    const siteFooter = document.getElementById('site-footer');
    if (siteFooter) siteFooter.style.display = 'none';
    const siteHeader = document.getElementById('main-site-header');
    if (siteHeader) siteHeader.style.display = 'none';
    roomNameEl.innerText = roomName;

    // Handle room info badge (Room ID & Password) display
    const infoBadge = document.getElementById('room-info-badge');
    if (infoBadge) {
        if (roomId) {
            infoBadge.style.display = 'inline-flex';
            document.getElementById('info-room-id').innerText = roomId;
            const passWrapper = document.getElementById('info-room-pass-wrapper');
            if (passWrapper) {
                if (password) {
                    passWrapper.style.display = 'inline-flex';
                    document.getElementById('info-room-pass').innerText = password;
                } else {
                    passWrapper.style.display = 'none';
                }
            }
        } else {
            infoBadge.style.display = 'none';
        }
    }

    document.querySelectorAll('.room-item').forEach(li => {
        if (li.innerText.includes(roomName)) li.classList.add('active');
    });
}

function switchRoom(newRoom) {
    chatMessages.innerHTML = '';
    top3Users = []; // Reset leaderboard badges for new room
    unreadCounts[newRoom] = 0; // Clear unread for room we're entering
    currentRoom = newRoom;
    roomNameEl.innerText = newRoom;
    
    // Hide info badge when switching to general rooms
    const infoBadge = document.getElementById('room-info-badge');
    if (infoBadge) infoBadge.style.display = 'none';
    
    socket.emit('joinRoom', { username: currentUsername, room: newRoom, userId: currentUserId });
    typingUsers.clear();
    if (typingIndicator) typingIndicator.style.display = 'none';
    fetchRooms(); // Refresh UI state
}

// Socket Events
socket.on('rooms-updated', (rooms) => {
    if (Array.isArray(rooms)) {
        cachedRooms = rooms;
        renderRooms(rooms);
    }
});

socket.on('roomUsers', ({ users, isPrivate }) => {
    isCurrentRoomPrivate = !!isPrivate;
    if (Array.isArray(users)) {
        activeUsers = users;
        
        // Re-render users list in panel if it is currently open
        if (usersListPanel && usersListPanel.style.display !== 'none') {
            renderPanelUsers();
        }
    }
    
    // Control leaderboard button visibility
    const leaderboardBtnEl = document.getElementById('leaderboard-btn');
    if (leaderboardBtnEl) {
        if (isPrivate) {
            leaderboardBtnEl.style.display = 'none';
        } else {
            leaderboardBtnEl.style.display = 'inline-flex';
        }
    }

    // Control event banner visibility
    const eventBannerEl = document.getElementById('event-banner');
    if (eventBannerEl) {
        if (isPrivate) {
            eventBannerEl.style.display = 'none';
        } else if (typeof eventBannerData !== 'undefined' && eventBannerData) {
            eventBannerEl.style.display = 'flex';
            updateEventBannerUI();
        }
    }

    // Control users list button visibility based on isPrivate
    if (usersListBtn) {
        if (isPrivate) {
            usersListBtn.style.display = 'inline-flex';
        } else {
            usersListBtn.style.display = 'none';
            if (usersListPanel) usersListPanel.style.display = 'none';
        }
    }
});

socket.on('message', (msg) => {
    const isAtBottom = (chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop) <= 150;
    const isOwnMessage = msg.senderId === socket.id;
    outputMessage(msg);
    if (isAtBottom || isOwnMessage) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Check if the current user is mentioned by someone else in the room
    const isMentioned = msg.text && msg.senderId !== socket.id && msg.senderId !== 'system' &&
                        currentUsername && msg.text.includes(`@${currentUsername}`);

    if (isMentioned) {
        playMentionSound();
        if (!isTabFocused && Notification.permission === 'granted') {
            new Notification(`Mentioned by ${msg.username} in ${currentRoom}`, { body: msg.text, icon: '/favicon.png' });
        }
    } else {
        // Sound + browser notification when tab not focused
        if (!isTabFocused && msg.senderId !== socket.id && msg.senderId !== 'system') {
            playNotificationSound();
            if (Notification.permission === 'granted') {
                new Notification(`${msg.username} in ${currentRoom}`, { body: msg.text || (msg.docData ? '[Document: ' + msg.docName + ']' : '[Image]'), icon: '/favicon.png' });
            }
        }
    }

    // Track unread for other rooms (messages from server relay)
    // This handles messages in current room - unread for other rooms handled by room-message event
});

// Unread messages for other rooms (render sidebar badge locally from memory)
socket.on('room-message', ({ room }) => {
    if (room !== currentRoom) {
        unreadCounts[room] = (unreadCounts[room] || 0) + 1;
        renderRooms(cachedRooms); // re-render sidebar locally without HTTP request
    }
});



// Room counts from server (render sidebar counts locally from memory)
socket.on('room-counts', (counts) => {
    roomCounts = counts;
    renderRooms(cachedRooms); // re-render sidebar locally without HTTP request
});

// Online count update
socket.on('online-count', (count) => {
    const el = document.getElementById('online-count-num');
    if (el) el.textContent = count;
});

// Typing indicator
const typingIndicator = document.getElementById('typing-indicator');
const typingUser = document.getElementById('typing-user');
let typingUsers = new Set();
let typingHideTimeout = null;

socket.on('user-typing', ({ username }) => {
    typingUsers.add(username);
    updateTypingDisplay();
});

socket.on('user-stop-typing', ({ username }) => {
    typingUsers.delete(username);
    updateTypingDisplay();
});

function updateTypingDisplay() {
    if (typingUsers.size > 0) {
        typingIndicator.style.display = 'flex';
        const names = Array.from(typingUsers);
        typingUser.textContent = names.length > 2 ? `${names[0]} and ${names.length - 1} others` : names.join(' and ');
    } else {
        typingIndicator.style.display = 'none';
    }
}

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

// Handle successful room creation
socket.on('roomCreated', ({ roomId, roomName }) => {
    if (inviteTarget) {
        // We are in the middle of inviting someone to a private room!
        const inviteLink = `${window.location.origin}/?room=${roomId}&password=${inviteTarget.password}`;
        const inviteMessage = `Hey, I created a private room for us to chat! Click here to join: ${inviteLink}`;
        
        // Send the whisper in the current room before switching
        socket.emit('whisper', {
            recipientUserId: inviteTarget.userId,
            text: inviteMessage
        });
        
        const pwd = inviteTarget.password;
        inviteTarget = null;
        
        // Switch the host to the new private room
        currentRoom = roomId;
        socket.emit('joinRoom', {
            username: currentUsername,
            room: roomId,
            password: pwd,
            userId: currentUserId
        });
        enterChatRoom(roomName, roomId, pwd);
    } else {
        currentRoom = roomId;
        const isPrivate = selectedRoomType === 'private';
        const password = document.getElementById('create-room-password').value;
        
        socket.emit('joinRoom', { username: currentUsername, room: roomId, password: isPrivate ? password : null, userId: currentUserId });
        enterChatRoom(roomName, roomId, isPrivate ? password : null);
    }
});

// Handle custom joining errors (reset UI to onboarding join screen)
socket.on('incorrect-password', () => {
    rollbackToJoinScreen();
});

socket.on('room-not-found', () => {
    rollbackToJoinScreen();
});

function rollbackToJoinScreen() {
    joinScreen.style.display = 'block';
    chatScreen.style.display = 'none';
    const siteFooter = document.getElementById('site-footer');
    if (siteFooter) siteFooter.style.display = 'block';
    const siteHeader = document.getElementById('main-site-header');
    if (siteHeader) siteHeader.style.display = 'flex';
}

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

    if (activeWhisperRecipient) {
        socket.emit('whisper', {
            recipientUserId: activeWhisperRecipient.userId,
            text,
            replyTo: replyToId,
            replyToText: replyToText
        });
    } else {
        socket.emit('chatMessage', { text, replyTo: replyToId, replyToText: replyToText });
    }

    msgInput.value = '';
    msgInput.focus();
    clearReply();
    socket.emit('stop-typing');
});

// Output Message
function outputMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message';
    div.dataset.id = msg.id;

    // Classes
    if (msg.senderId === socket.id) div.classList.add('my-message');
    if (msg.isAdmin) div.classList.add('admin-message');
    if (msg.isWhisper) div.classList.add('whisper-message');
    
    // Highlight if current user is mentioned in the text
    if (msg.text && currentUsername && msg.text.includes(`@${currentUsername}`)) {
        div.classList.add('mention-highlight');
    }

    // Meta
    const meta = document.createElement('div');
    meta.className = 'meta';

    // REMOVED PROFILE PICTURE (User request 5)

    const name = document.createElement('span');
    name.className = 'username';
    name.innerText = msg.username;
    name.style.color = msg.color || '#fff';
    meta.appendChild(name);

    const msgUserId = msg.userId || msg.senderId;
    if (msg.username !== 'System' && msgUserId && msgUserId !== 'system' && msgUserId !== currentUserId) {
        name.style.cursor = 'pointer';
        name.dataset.userId = msgUserId;
        name.dataset.username = msg.username;
        name.onclick = (e) => {
            e.stopPropagation();
            if (usernameContextMenu) {
                usernameContextMenu.style.display = 'block';
                const menuWidth = 180;
                const menuHeight = 80;
                let x = e.pageX;
                let y = e.pageY;
                if (x + menuWidth > window.innerWidth + window.scrollX) {
                    x = window.innerWidth + window.scrollX - menuWidth - 10;
                }
                if (y + menuHeight > window.innerHeight + window.scrollY) {
                    y = window.innerHeight + window.scrollY - menuHeight - 10;
                }
                usernameContextMenu.style.left = `${x}px`;
                usernameContextMenu.style.top = `${y}px`;
                usernameContextMenu.dataset.targetUserId = msgUserId;
                usernameContextMenu.dataset.targetUsername = msg.username;
            }
        };
    }

    if (msg.isWhisper) {
        // Add lock icon
        const lock = document.createElement('span');
        lock.className = 'whisper-lock';
        lock.innerHTML = '<i class="fas fa-lock"></i> ';
        lock.style.color = '#a855f7';
        lock.style.marginRight = '4px';
        meta.insertBefore(lock, name);
        
        // Change username label or text
        if (msgUserId === currentUserId) {
            name.innerText = `Whisper to ${msg.whisperRecipientUsername || 'user'}`;
        } else {
            name.innerText = `Whisper from ${msg.username}`;
        }
    }

    // Mod Badge (Checkmark) (User request 4)
    if (msg.isAdmin) {
        const badge = document.createElement('span');
        badge.innerHTML = '<i class="fas fa-check-circle"></i> MOD';
        badge.style.color = '#ffd700';
        badge.style.marginLeft = '5px';
        badge.style.fontSize = '0.8rem';
        meta.appendChild(badge);
    }

    // Leaderboard Rank Badge (Top 3)
    if (msg.username && msg.username !== 'System') {
        const rankBadge = document.createElement('span');
        rankBadge.className = 'chat-rank-badge';
        const msgUserId = msg.userId || msg.senderId;
        rankBadge.dataset.userId = msgUserId;
        rankBadge.style.display = 'none';
        if (typeof top3Users !== 'undefined' && Array.isArray(top3Users)) {
            const entry = top3Users.find(e => e.userId === msgUserId);
            if (entry) {
                rankBadge.style.display = 'inline-flex';
                rankBadge.classList.add('rank-badge-' + entry.rank);
                if (entry.rank === 1) rankBadge.innerHTML = '<i class="fas fa-crown"></i>';
                else if (entry.rank === 2) rankBadge.innerHTML = '<i class="fas fa-medal"></i>';
                else if (entry.rank === 3) rankBadge.innerHTML = '<i class="fas fa-medal"></i>';
            }
        }
        meta.appendChild(rankBadge);
    }

    const time = document.createElement('span');
    time.className = 'time';
    // Format timestamp locally so users see their own time zone
    if (msg.createdAt) {
        time.innerText = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        time.innerText = msg.time;
    }
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
        const wrapper = document.createElement('div');
        wrapper.className = 'blurred-image-wrapper';
        
        const img = document.createElement('img');
        img.src = msg.imageData;
        img.className = 'message-image';
        wrapper.appendChild(img);
        
        const overlay = document.createElement('div');
        overlay.className = 'blur-overlay';
        overlay.innerHTML = `
            <i class="fas fa-eye-slash blur-warning-icon"></i>
            <div>Sensitive Content</div>
            <div style="font-size: 0.7rem; opacity: 0.8; margin-top: 4px;">Click to reveal</div>
        `;
        wrapper.appendChild(overlay);
        
        wrapper.onclick = () => {
            wrapper.classList.toggle('unblurred');
        };
        
        div.appendChild(wrapper);
    }

    // Document
    if (msg.docData) {
        const docWrapper = document.createElement('div');
        docWrapper.className = 'document-wrapper';
        
        const docIcon = document.createElement('i');
        docIcon.className = 'fas fa-file-alt document-icon';
        
        const docInfo = document.createElement('div');
        docInfo.className = 'document-info';
        
        const docName = document.createElement('div');
        docName.className = 'document-name';
        docName.innerText = msg.docName || 'document';
        
        const docSize = document.createElement('div');
        docSize.className = 'document-size';
        const sizeMb = msg.docSize ? (msg.docSize / 1024 / 1024).toFixed(2) : 0;
        docSize.innerText = sizeMb + ' MB';
        
        docInfo.appendChild(docName);
        docInfo.appendChild(docSize);
        
        const downloadBtn = document.createElement('a');
        downloadBtn.href = msg.docData;
        downloadBtn.download = msg.docName || 'document';
        downloadBtn.className = 'document-download';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
        
        docWrapper.appendChild(docIcon);
        docWrapper.appendChild(docInfo);
        docWrapper.appendChild(downloadBtn);
        
        div.appendChild(docWrapper);
    }

    // Text with clickable links
    if (msg.text) {
        const p = document.createElement('p');
        p.className = 'text';
        p.innerHTML = linkify(msg.text);
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
        replyToText = msg.text || (msg.docData ? '[Document]' : '[Image]');
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
        const file = this.files[0];
        // Enforce 500KB client-side limit
        if (file.size > 5 * 1024 * 1024) {
            showError('Image too large. Max 5MB.');
            this.value = '';
            return;
        }
        const r = new FileReader();
        r.onload = (e) => {
            socket.emit('chatImage', { imageData: e.target.result, replyTo: replyToId, replyToText: replyToText });
            clearReply();
        };
        r.readAsDataURL(file);
    }
    this.value = '';
};

// Document upload handler
docInput.onchange = function () {
    if (this.files[0]) {
        const file = this.files[0];
        if (file.size > 50 * 1024 * 1024) {
            showError('Document too large. Max 50MB.');
            this.value = '';
            return;
        }
        const r = new FileReader();
        r.onload = (e) => {
            socket.emit('chatDocument', { docData: e.target.result, docName: file.name, docSize: file.size, replyTo: replyToId, replyToText: replyToText });
            clearReply();
        };
        r.readAsDataURL(file);
    }
    this.value = '';
};

// Typing emit + autocomplete check on input
msgInput.addEventListener('input', () => {
    socket.emit('typing');
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('stop-typing'), 2000);

    // Check for active autocomplete state
    const value = msgInput.value;
    const selectionEnd = msgInput.selectionEnd;
    const textBeforeCursor = value.slice(0, selectionEnd);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
        const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : '';
        if (charBeforeAt === '' || /\s/.test(charBeforeAt)) {
            const query = textBeforeCursor.slice(lastAtIdx + 1);
            if (!/\s/.test(query)) {
                isMentionActive = true;
                mentionStartIdx = lastAtIdx;
                mentionSearchQuery = query;
                filterAndShowAutocomplete(query);
                return;
            }
        }
    }
    hideAutocomplete();
});

// Keydown listener for autocomplete navigation
msgInput.addEventListener('keydown', (e) => {
    if (!isMentionActive) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedMentionIndex = (selectedMentionIndex + 1) % filteredMentionUsers.length;
        updateActiveAutocompleteItem();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedMentionIndex = (selectedMentionIndex - 1 + filteredMentionUsers.length) % filteredMentionUsers.length;
        updateActiveAutocompleteItem();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedMentionIndex >= 0 && selectedMentionIndex < filteredMentionUsers.length) {
            selectAutocompleteUser(filteredMentionUsers[selectedMentionIndex].username);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
    }
});

// URL detection - make links clickable and format @mentions
function linkify(text) {
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    // Replace URL links first. Stop matching on spaces, brackets, or unescaped/escaped quote chars.
    escaped = escaped.replace(
        /(https?:\/\/[^\s<>&"'\(\)]+(?:#[^\s<>&"'\(\)]*)?)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#7289da;text-decoration:underline;">$1</a>'
    );

    // Replace @mentions with pill badges (case-insensitive username check)
    escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, (match, username) => {
        const isMe = currentUsername && username.toLowerCase() === currentUsername.toLowerCase();
        const badgeClass = isMe ? 'mention-tag me' : 'mention-tag';
        return `<span class="${badgeClass}">@${username}</span>`;
    });

    return escaped;
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    // Ask after first interaction
    document.addEventListener('click', function askNotif() {
        Notification.requestPermission();
        document.removeEventListener('click', askNotif);
    }, { once: true });
}

// Close emoji & autocomplete on outside click
document.onclick = (e) => {
    if (!e.target.closest('.action-btn') && !emojiPicker.contains(e.target)) emojiPicker.style.display = 'none';
    if (!e.target.closest('#mention-autocomplete') && e.target !== msgInput) {
        hideAutocomplete();
    }
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

// ============================================
// SHARE / EXPORT FUNCTIONALITY
// ============================================
let isSelectionMode = false;
let selectedMessages = new Set();
const selectionControls = document.getElementById('selection-controls');
const generateShareBtn = document.getElementById('generate-share-btn');
const cancelShareBtn = document.getElementById('cancel-share-btn');
const shareModal = document.getElementById('share-modal');
const closeModalBtn = document.querySelector('.close-modal');
const sharePreview = document.getElementById('share-preview');
const downloadLink = document.getElementById('download-link');
const exportContainer = document.getElementById('export-container');
const exportList = document.getElementById('export-messages');

if (shareBtn) {
    shareBtn.onclick = () => toggleSelectionMode(true);
}

if (cancelShareBtn) {
    cancelShareBtn.onclick = () => toggleSelectionMode(false);
}

if (closeModalBtn) {
    closeModalBtn.onclick = () => shareModal.style.display = 'none';
}

function toggleSelectionMode(active) {
    isSelectionMode = active;
    selectedMessages.clear();

    if (active) {
        document.body.classList.add('selection-mode');
        // Hide chat form, show selection controls
        document.getElementById('chat-form').style.display = 'none';
        selectionControls.style.display = 'flex';
        // Clear previous selections visually
        document.querySelectorAll('.message').forEach(m => m.classList.remove('selected'));
    } else {
        document.body.classList.remove('selection-mode');
        document.getElementById('chat-form').style.display = 'flex';
        selectionControls.style.display = 'none';
        document.querySelectorAll('.message').forEach(m => m.classList.remove('selected'));
    }
}

// Delegate Click for Message Selection
chatMessages.addEventListener('click', (e) => {
    if (!isSelectionMode) return;

    const msgEl = e.target.closest('.message');
    if (!msgEl) return;

    // Prevent interaction with buttons inside
    e.preventDefault();
    e.stopPropagation();

    const id = msgEl.dataset.id;
    if (selectedMessages.has(id)) {
        selectedMessages.delete(id);
        msgEl.classList.remove('selected');
    } else {
        if (selectedMessages.size >= 10) return showError('Max 10 messages');
        selectedMessages.add(id);
        msgEl.classList.add('selected');
    }
});

// Generate Image
if (generateShareBtn) {
    generateShareBtn.onclick = async () => {
        if (selectedMessages.size === 0) return showError('Select at least one message');

        // 1. Populate Export Container
        exportList.innerHTML = '';

        // Sort selected messages by position in DOM to maintain order
        const allMessages = Array.from(document.querySelectorAll('.message'));
        const sortedSelected = allMessages.filter(m => selectedMessages.has(m.dataset.id));

        sortedSelected.forEach(el => {
            const clone = el.cloneNode(true);
            clone.classList.remove('selected');
            clone.style.margin = '10px 0'; // ensure spacing in image
            exportList.appendChild(clone);
        });

        // 2. Capture
        try {
            // Bring into viewport for html2canvas (off-screen elements fail to capture)
            exportContainer.style.visibility = 'visible';
            exportContainer.style.top = '0';
            exportContainer.style.left = '0';
            exportContainer.style.zIndex = '99999';

            // Small delay to allow browser to paint before capture
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(exportContainer, {
                backgroundColor: '#2c2f33',
                scale: 2, // High res
                logging: false,
                useCORS: true, // For images
                allowTaint: true,
                foreignObjectRendering: false
            });

            // Hide again
            exportContainer.style.visibility = 'hidden';
            exportContainer.style.top = '-9999px';
            exportContainer.style.left = '-9999px';
            exportContainer.style.zIndex = '-1';

            // 3. Show Modal
            sharePreview.innerHTML = '';
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            sharePreview.appendChild(img);

            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.download = `chathere_${Date.now()}.png`;
            shareModal.style.display = 'flex';

            toggleSelectionMode(false); // Exit mode

        } catch (err) {
            console.error(err);
            showError('Failed to generate image');
            exportContainer.style.visibility = 'hidden';
            exportContainer.style.top = '-9999px';
            exportContainer.style.left = '-9999px';
            exportContainer.style.zIndex = '-1';
        }
    };
}

// Close Modal outside click
window.onclick = (e) => {
    if (e.target === shareModal) shareModal.style.display = 'none';
};


// Share Room Button (P2)
const shareRoomBtn = document.getElementById('share-room-btn');
if (shareRoomBtn) {
    shareRoomBtn.onclick = async () => {
        const url = 'https://chathere.online/?room=' + encodeURIComponent(currentRoom);
        if (navigator.share) {
            try { await navigator.share({ title: 'Join me on ChatHere - ' + currentRoom, text: 'Chat anonymously in the ' + currentRoom + ' room!', url }); } catch(e) {}
        } else {
            navigator.clipboard.writeText(url).then(() => {
                const d = document.createElement('div');
                d.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#43b581;color:#fff;padding:10px 20px;border-radius:8px;z-index:10000;font-weight:600;';
                d.textContent = 'Room link copied!';
                document.body.appendChild(d);
                setTimeout(() => d.remove(), 2000);
            });
        }
    };
}

// ============================================
// @MENTION AUTOCOMPLETE UTILITIES
// ============================================
function filterAndShowAutocomplete(query) {
    // Filter activeUsers by matching the query (case insensitive)
    // Exclude the current user to prevent mentioning yourself
    filteredMentionUsers = activeUsers.filter(u => {
        if (currentUsername && u.username.toLowerCase() === currentUsername.toLowerCase()) {
            return false;
        }
        return u.username.toLowerCase().includes(query.toLowerCase());
    });

    if (filteredMentionUsers.length === 0) {
        hideAutocomplete();
        return;
    }

    // Limit to 8 results for a clean UI
    filteredMentionUsers = filteredMentionUsers.slice(0, 8);
    
    const autocompleteEl = document.getElementById('mention-autocomplete');
    if (!autocompleteEl) return;

    autocompleteEl.innerHTML = '';
    autocompleteEl.style.display = 'block';

    selectedMentionIndex = 0; // Default select first item

    filteredMentionUsers.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'mention-item';
        if (index === selectedMentionIndex) {
            item.classList.add('active');
        }

        // Color dot
        const dot = document.createElement('span');
        dot.className = 'mention-dot';
        dot.style.background = user.color || '#a5b4fc';

        // Name
        const name = document.createElement('span');
        name.className = 'mention-name';
        name.textContent = user.username;

        // Badge
        const badge = document.createElement('span');
        badge.className = 'badge-role'; // Let's use standard class
        badge.classList.add('mention-badge');
        if (user.isBot) {
            badge.classList.add('bot');
            badge.textContent = 'Bot';
        } else {
            badge.textContent = 'User';
        }

        item.appendChild(dot);
        item.appendChild(name);
        item.appendChild(badge);

        // Click selection
        item.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectAutocompleteUser(user.username);
        };

        autocompleteEl.appendChild(item);
    });
}

function selectAutocompleteUser(username) {
    const value = msgInput.value;
    const beforeMention = value.slice(0, mentionStartIdx);
    const afterMention = value.slice(msgInput.selectionEnd);
    
    // Insert autocomplete mention with a trailing space
    msgInput.value = beforeMention + `@${username} ` + afterMention;
    
    // Reset selection/cursor position right after inserted name and space
    const newCursorPos = mentionStartIdx + username.length + 2; // @ + name + space
    msgInput.setSelectionRange(newCursorPos, newCursorPos);
    
    hideAutocomplete();
    msgInput.focus();
}

function hideAutocomplete() {
    isMentionActive = false;
    selectedMentionIndex = -1;
    filteredMentionUsers = [];
    const autocompleteEl = document.getElementById('mention-autocomplete');
    if (autocompleteEl) {
        autocompleteEl.style.display = 'none';
    }
}

function updateActiveAutocompleteItem() {
    const autocompleteEl = document.getElementById('mention-autocomplete');
    if (!autocompleteEl) return;
    
    const items = autocompleteEl.querySelectorAll('.mention-item');
    items.forEach((item, index) => {
        if (index === selectedMentionIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

// ============================================
// PRIVATE ROOMS USER LIST POPUP PANEL
// ============================================
function renderPanelUsers() {
    if (!usersListContent || !usersListCount) return;
    
    usersListContent.innerHTML = '';
    usersListCount.textContent = activeUsers.length;
    
    activeUsers.forEach(u => {
        const li = document.createElement('li');
        li.className = 'panel-user-item';
        
        const dot = document.createElement('span');
        dot.className = 'panel-user-dot';
        
        const name = document.createElement('span');
        name.className = 'panel-user-name';
        name.textContent = u.username;
        name.style.color = u.color || '#fff';
        
        li.appendChild(dot);
        li.appendChild(name);
        
        if (u.username === currentUsername) {
            const tag = document.createElement('span');
            tag.className = 'panel-user-tag you';
            tag.textContent = 'You';
            li.appendChild(tag);
        } else if (u.isBot) {
            const tag = document.createElement('span');
            tag.className = 'panel-user-tag bot';
            tag.textContent = 'Bot';
            li.appendChild(tag);
        }
        
        usersListContent.appendChild(li);
    });
}

if (usersListBtn && usersListPanel) {
    usersListBtn.onclick = (e) => {
        e.stopPropagation();
        const isHidden = usersListPanel.style.display === 'none';
        if (isHidden) {
            usersListPanel.style.display = 'flex';
            renderPanelUsers();
        } else {
            usersListPanel.style.display = 'none';
        }
    };
    
    usersListPanel.onclick = (e) => {
        e.stopPropagation();
    };
}

window.addEventListener('click', () => {
    if (usersListPanel && usersListPanel.style.display !== 'none') {
        usersListPanel.style.display = 'none';
    }
});

// ============================================
// PASSWORD VISIBILITY TOGGLE HELPER
// ============================================
function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btnEl.querySelector('i');
    if (!icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}


// ============================================
// LEADERBOARD FEATURE
// ============================================
let top3Users = [];
let leaderboardCountdownInterval = null;

// --- Leaderboard Modal Elements ---
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const myLeaderboardRank = document.getElementById('my-leaderboard-rank');
const resetCountdown = document.getElementById('reset-countdown');
const closeLeaderboardBtn = document.getElementById('close-leaderboard');
const leaderboardBtnEl = document.getElementById('leaderboard-btn');

// --- Open Leaderboard ---
if (leaderboardBtnEl) {
    leaderboardBtnEl.onclick = (e) => {
        e.stopPropagation();
        socket.emit('get-leaderboard');
        leaderboardModal.style.display = 'flex';
    };
}

// --- Close Leaderboard ---
if (closeLeaderboardBtn) {
    closeLeaderboardBtn.onclick = () => {
        leaderboardModal.style.display = 'none';
        if (leaderboardCountdownInterval) {
            clearInterval(leaderboardCountdownInterval);
            leaderboardCountdownInterval = null;
        }
    };
}

// Close on background click
window.addEventListener('mousedown', (e) => {
    if (e.target === leaderboardModal) {
        leaderboardModal.style.display = 'none';
        if (leaderboardCountdownInterval) {
            clearInterval(leaderboardCountdownInterval);
            leaderboardCountdownInterval = null;
        }
    }
});

// --- Socket: Receive full leaderboard data ---
socket.on('leaderboard-data', ({ leaderboard, myRank, msUntilReset }) => {
    renderLeaderboard(leaderboard, myRank);
    startCountdown(msUntilReset);
});

// --- Socket: Top 3 changed (real-time badge updates) ---
socket.on('room-leaderboard-top3', (newTop3) => {
    top3Users = newTop3 || [];
    updateAllRankBadges();
});

// --- Socket: Hourly reset ---
socket.on('leaderboard-reset', () => {
    top3Users = [];
    updateAllRankBadges();
    // If leaderboard modal is open, clear it
    if (leaderboardModal && leaderboardModal.style.display !== 'none') {
        renderLeaderboard([], null);
        startCountdown(60 * 60 * 1000);
    }
});

// --- Render Leaderboard List ---
function renderLeaderboard(leaderboard, myRank) {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';

    if (!leaderboard || leaderboard.length === 0) {
        leaderboardList.innerHTML = `
            <div class="leaderboard-empty">
                <i class="fas fa-ghost"></i>
                No messages yet this hour.<br>Be the first to chat and claim #1!
            </div>
        `;
    } else {
        leaderboard.forEach(entry => {
            const item = document.createElement('div');
            const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : 'rank-other';
            const isMe = entry.userId === currentUserId;
            item.className = `leaderboard-item ${rankClass}${isMe ? ' is-me' : ''}`;

            // Rank circle
            const rankEl = document.createElement('div');
            rankEl.className = 'leaderboard-rank';
            if (entry.rank === 1) rankEl.innerHTML = '<i class="fas fa-crown"></i>';
            else if (entry.rank === 2) rankEl.innerHTML = '<i class="fas fa-medal"></i>';
            else if (entry.rank === 3) rankEl.innerHTML = '<i class="fas fa-medal"></i>';
            else rankEl.textContent = `#${entry.rank}`;
            item.appendChild(rankEl);

            // User info
            const info = document.createElement('div');
            info.className = 'leaderboard-user-info';
            const nameSpan = document.createElement('div');
            nameSpan.className = 'leaderboard-username';
            nameSpan.textContent = entry.username + (isMe ? ' (You)' : '');
            info.appendChild(nameSpan);
            const countSpan = document.createElement('div');
            countSpan.className = 'leaderboard-msg-count';
            countSpan.textContent = `${entry.count} message${entry.count !== 1 ? 's' : ''}`;
            info.appendChild(countSpan);
            item.appendChild(info);

            // Count badge
            const badge = document.createElement('div');
            badge.className = 'leaderboard-count-badge';
            badge.textContent = entry.count;
            item.appendChild(badge);

            leaderboardList.appendChild(item);
        });
    }

    // My rank section
    if (myLeaderboardRank) {
        if (myRank) {
            myLeaderboardRank.innerHTML = `
                <div class="my-rank-card">
                    <div>
                        <div class="my-rank-label">Your Position</div>
                        <div class="my-rank-value">#${myRank.rank}</div>
                    </div>
                    <div class="my-rank-msgs">${myRank.count} message${myRank.count !== 1 ? 's' : ''} this hour</div>
                </div>
            `;
        } else {
            myLeaderboardRank.innerHTML = `
                <div class="my-rank-card">
                    <div>
                        <div class="my-rank-label">Your Position</div>
                        <div class="my-rank-value">Unranked</div>
                    </div>
                    <div class="my-rank-msgs">Send a message to join!</div>
                </div>
            `;
        }
    }
}

// --- Countdown Timer ---
function startCountdown(msRemaining) {
    if (leaderboardCountdownInterval) {
        clearInterval(leaderboardCountdownInterval);
    }

    let remaining = msRemaining;

    function updateDisplay() {
        if (!resetCountdown) return;
        const totalSecs = Math.max(0, Math.floor(remaining / 1000));
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        resetCountdown.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    updateDisplay();
    leaderboardCountdownInterval = setInterval(() => {
        remaining -= 1000;
        if (remaining <= 0) {
            remaining = 0;
            clearInterval(leaderboardCountdownInterval);
            leaderboardCountdownInterval = null;
        }
        updateDisplay();
    }, 1000);
}

// --- Update All Rank Badges in Chat ---
function updateAllRankBadges() {
    const allBadges = document.querySelectorAll('.chat-rank-badge');
    allBadges.forEach(badge => {
        const userId = badge.dataset.userId;
        // Reset
        badge.style.display = 'none';
        badge.className = 'chat-rank-badge';
        badge.innerHTML = '';

        if (top3Users && top3Users.length > 0) {
            const entry = top3Users.find(e => e.userId === userId);
            if (entry) {
                badge.style.display = 'inline-flex';
                badge.classList.add('rank-badge-' + entry.rank);
                if (entry.rank === 1) badge.innerHTML = '<i class="fas fa-crown"></i>';
                else if (entry.rank === 2) badge.innerHTML = '<i class="fas fa-medal"></i>';
                else if (entry.rank === 3) badge.innerHTML = '<i class="fas fa-medal"></i>';
            }
        }
    });
}




// ============================================
// DAILY EVENTS FEATURE
// ============================================
let eventCountdownInterval = null;
let eventBannerData = null;

socket.on('event-status', (status) => {
    eventBannerData = status;
    updateEventBannerUI();
    startEventCountdownTicker();
});

function updateEventBannerUI() {
    const banner = document.getElementById('event-banner');
    const textEl = document.getElementById('event-text');
    const timerEl = document.getElementById('event-timer');
    if (!banner || !textEl || !timerEl) return;

    if (isCurrentRoomPrivate || !eventBannerData) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'flex';

    if (eventBannerData.active) {
        banner.classList.add('event-live');
        textEl.innerHTML = `?? LIVE: <strong>${eventBannerData.name}</strong> hosted by <strong>${eventBannerData.host}</strong> in General!`;
        const ms = eventBannerData.timeRemaining;
        timerEl.textContent = formatMsToTime(ms);
    } else {
        banner.classList.remove('event-live');
        textEl.innerHTML = `? Next Event: <strong>${eventBannerData.name}</strong>`;
        const ms = eventBannerData.msUntil;
        timerEl.textContent = formatMsToTime(ms);
    }
}

function startEventCountdownTicker() {
    if (eventCountdownInterval) clearInterval(eventCountdownInterval);

    eventCountdownInterval = setInterval(() => {
        if (!eventBannerData) return;

        if (eventBannerData.active) {
            eventBannerData.timeRemaining = Math.max(0, eventBannerData.timeRemaining - 1000);
        } else {
            eventBannerData.msUntil = Math.max(0, eventBannerData.msUntil - 1000);
        }
        
        const timerEl = document.getElementById('event-timer');
        if (timerEl) {
            const ms = eventBannerData.active ? eventBannerData.timeRemaining : eventBannerData.msUntil;
            timerEl.textContent = formatMsToTime(ms);
        }
    }, 1000);
}

function formatMsToTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}


// ============================================
// DRAG AND DROP IMAGE SHARING
// ============================================
const chatContainerEl = document.querySelector('.chat-container');
const dragOverlayEl = document.getElementById('drag-overlay');

if (chatContainerEl && dragOverlayEl) {
    let dragCounter = 0;

    chatContainerEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) {
            dragOverlayEl.style.display = 'flex';
            setTimeout(() => dragOverlayEl.classList.add('active'), 10);
        }
    });

    chatContainerEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            dragOverlayEl.classList.remove('active');
            setTimeout(() => {
                if (!dragOverlayEl.classList.contains('active')) {
                    dragOverlayEl.style.display = 'none';
                }
            }, 250);
        }
    });

    chatContainerEl.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    chatContainerEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dragOverlayEl.classList.remove('active');
        dragOverlayEl.style.display = 'none';

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                showError('Only images can be shared');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showError('Image too large. Max 5MB.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                socket.emit('chatImage', { imageData: event.target.result, replyTo: replyToId, replyToText: replyToText });
                clearReply();
            };
            reader.readAsDataURL(file);
        }
    });
}


// ============================================
// WEB PUSH NOTIFICATIONS
// ============================================
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

function showSuccess(msg) {
    const el = document.getElementById('error-message');
    if (!el) return;
    const prevBg = el.style.background;
    el.textContent = msg;
    el.style.background = 'rgba(52,211,153,0.92)';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; el.style.background = prevBg; }, 3000);
}

async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const bellBtn = document.getElementById('push-bell-btn');
    if (!bellBtn) return;

    if (Notification.permission === 'granted') {
        bellBtn.classList.add('push-subscribed');
        bellBtn.title = 'Notifications ON';
    }

    bellBtn.addEventListener('click', async () => {
        if (Notification.permission === 'denied') {
            showError('Notifications blocked. Please enable in your browser settings.');
            return;
        }
        try {
            const resp = await fetch('/api/push/vapid-public-key');
            const { publicKey } = await resp.json();
            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });
            bellBtn.classList.add('push-subscribed');
            bellBtn.title = 'Notifications ON';
            showSuccess('?? Notifications enabled! We\'ll ping you when things get busy.');
        } catch(err) {
            console.error('[Push] Subscribe error:', err);
            showError('Could not enable notifications. Try again later.');
        }
    });
}



// ============================================
// GLOBE — WHO'S ONLINE
// ============================================
socket.on('country-counts', (counts) => {
    if (window.globeModule) window.globeModule.updateGlobe(counts);
});

window.addEventListener('mousedown', (e) => {
    const gm = document.getElementById('globe-modal');
    if (gm && e.target === gm) window.globeModule && window.globeModule.closeGlobe();
});