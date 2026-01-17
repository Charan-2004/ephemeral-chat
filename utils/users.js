const users = [];

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
function userJoin(id, username, room) {
    const user = {
        id,
        username,
        room,
        color: generateColor(),
        lastMessageTime: 0
    };
    users.push(user);
    return user;
}

// Get current user
function getCurrentUser(id) {
    return users.find(user => user.id === id);
}

// User leaves chat
function userLeave(id) {
    const index = users.findIndex(user => user.id === id);

    if (index !== -1) {
        return users.splice(index, 1)[0];
    }
}

// Get room users
function getRoomUsers(room) {
    return users.filter(user => user.room === room);
}

// Get room user count only
function getRoomUserCount(room) {
    return users.filter(user => user.room === room).length;
}

// Update last message time
function updateLastMessageTime(id) {
    const user = users.find(user => user.id === id);
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
