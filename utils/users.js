const usersById = new Map();
const roomUsersMap = new Map(); // room -> Set<userId>

// Fixed distinct color palette
const COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Cyan
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Lavender
    '#FF9F43', // Orange
    '#54A0FF', // Blue
    '#5F27CD', // Purple
    '#FF9FF3', // Pink
    '#00D2D3', // Bright Cyan
    '#55E6C1', // Mint
    '#FFC312', // Sunflower
    '#C4E538', // Lime
    '#12CBC4'  // Aqua
];

let colorIndex = 0;

// Assign next color in sequence
function generateColor() {
    const color = COLORS[colorIndex];
    colorIndex = (colorIndex + 1) % COLORS.length;
    return color;
}

// Join user to chat
function userJoin(id, username, room, isBot = false) {
    // Remove from old room if re-joining
    if (usersById.has(id)) {
        const old = usersById.get(id);
        const oldSet = roomUsersMap.get(old.room);
        if (oldSet) oldSet.delete(id);
    }
    const user = {
        id,
        username,
        room,
        color: generateColor(),
        lastMessageTime: 0,
        isBot
    };
    usersById.set(id, user);
    if (!roomUsersMap.has(room)) roomUsersMap.set(room, new Set());
    roomUsersMap.get(room).add(id);
    return user;
}

// Get current user
function getCurrentUser(id) {
    return usersById.get(id) || null;
}

// User leaves chat
function userLeave(id) {
    const user = usersById.get(id);
    if (!user) return undefined;
    usersById.delete(id);
    const set = roomUsersMap.get(user.room);
    if (set) set.delete(id);
    return user;
}

// Get room users
function getRoomUsers(room) {
    const set = roomUsersMap.get(room);
    if (!set || set.size === 0) return [];
    const result = [];
    for (const id of set) {
        const user = usersById.get(id);
        if (user) result.push(user);
    }
    return result;
}

// Get room user count only
function getRoomUserCount(room) {
    const set = roomUsersMap.get(room);
    return set ? set.size : 0;
}

// Update last message time
function updateLastMessageTime(id) {
    const user = usersById.get(id);
    if (user) {
        user.lastMessageTime = Date.now();
    }
}

module.exports = {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
    getRoomUserCount,
    updateLastMessageTime
};
