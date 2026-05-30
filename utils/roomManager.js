const { getRoomUserCount, getRoomUsers } = require('./users');
const config = require('./config');

// Default rooms
const rooms = [
    { name: 'General', id: 'General', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Tech', id: 'Tech', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Music', id: 'Music', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Movies', id: 'Movies', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Politics', id: 'Politics', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Gaming', id: 'Gaming', isCustom: false, isPrivate: false, locked: false, reason: '' }
];

let pinnedMessage = null;

// --- Room ID Generation ---

function generateRoomId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let id = [];
    for (let i = 0; i < 4; i++) {
        id.push(letters.charAt(Math.floor(Math.random() * letters.length)));
        id.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
    }
    // Fisher-Yates shuffle
    for (let i = id.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [id[i], id[j]] = [id[j], id[i]];
    }
    return id.join('');
}

function generateUniqueRoomId() {
    let attempts = 0;
    while (attempts < 1000) {
        const id = generateRoomId();
        if (!rooms.find(r => r.id === id || r.name === id)) {
            return id;
        }
        attempts++;
    }
    throw new Error('Failed to generate unique Room ID');
}

// --- Room Accessors ---

function getRooms() { return rooms; }

function findRoom(idOrName) {
    return rooms.find(r => r.id === idOrName || r.name === idOrName);
}

function getPublicRooms() {
    return rooms.filter(r => !r.isPrivate);
}

// --- Room Mutations (all use splice to preserve array identity) ---

function addRoom(room) {
    rooms.push(room);
}

function removeRoom(roomId) {
    const idx = rooms.findIndex(r => r.id === roomId);
    if (idx !== -1) {
        rooms.splice(idx, 1);
        return true;
    }
    return false;
}

function removeRoomByName(name) {
    const idx = rooms.findIndex(r => r.name === name);
    if (idx !== -1) {
        rooms.splice(idx, 1);
        return true;
    }
    return false;
}

// --- Unified Room Cleanup ---
// Consolidates the duplicated cleanup logic from joinRoom, disconnect, and periodic timer

function tryCleanupRoom(roomId, io) {
    const roomConfig = findRoom(roomId);
    if (!roomConfig || !roomConfig.isCustom) return false;

    const count = getRoomUserCount(roomId);
    if (count === 0) {
        removeRoom(roomId);
        if (io) io.emit('rooms-updated', getPublicRooms());
        return true;
    }
    return false;
}

function cleanupIdleCustomRooms() {
    const now = Date.now();
    let changed = false;
    // Iterate in reverse to safely splice
    for (let i = rooms.length - 1; i >= 0; i--) {
        const r = rooms[i];
        if (!r.isCustom) continue;
        const userCount = getRoomUserCount(r.id);
        const ageMs = now - (r.createdAt || 0);
        if (userCount === 0 && ageMs > config.customRoomMaxAgeMs) {
            rooms.splice(i, 1);
            changed = true;
        }
    }
    return changed;
}

// --- Debounced Room Counts Broadcast ---

let _broadcastTimer = null;
function broadcastRoomCounts(io) {
    if (_broadcastTimer) return;
    _broadcastTimer = setTimeout(() => {
        _broadcastTimer = null;
        const counts = {};
        rooms.forEach(r => {
            counts[r.id] = getRoomUserCount(r.id);
        });
        io.emit('room-counts', counts);
    }, 500);
}

// --- Pinned Message State ---

function getPinnedMessage() { return pinnedMessage; }
function setPinnedMessage(msg) { pinnedMessage = msg; }

// --- Room Users Broadcast Helper ---

function emitRoomUsers(io, room, extraFields) {
    const payload = {
        room,
        count: getRoomUserCount(room),
        users: getRoomUsers(room).map(u => ({
            username: u.username,
            id: u.id,
            isBot: u.isBot,
            color: u.color
        })),
        ...extraFields
    };
    io.to(room).emit('roomUsers', payload);
}

module.exports = {
    getRooms,
    findRoom,
    addRoom,
    removeRoom,
    removeRoomByName,
    generateUniqueRoomId,
    tryCleanupRoom,
    cleanupIdleCustomRooms,
    broadcastRoomCounts,
    getPinnedMessage,
    setPinnedMessage,
    getPublicRooms,
    emitRoomUsers
};