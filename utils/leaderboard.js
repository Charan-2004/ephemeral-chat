// Leaderboard: tracks per-room message counts and resets every hour.
// Tracks by user ID internally to prevent username spoofing.

// roomId -> Map(userId -> { username, count })
const roomLeaderboards = new Map();

// Timestamp of last reset (used to compute countdown on the client)
let lastResetTime = Date.now();

// Cache of the current Top 3 per room (for change detection)
const roomTop3Cache = new Map(); // roomId -> [userId1, userId2, userId3]

// --- Core Operations ---

function recordMessage(roomId, userId, username) {
    if (!roomLeaderboards.has(roomId)) {
        roomLeaderboards.set(roomId, new Map());
    }
    const board = roomLeaderboards.get(roomId);
    const existing = board.get(userId);
    if (existing) {
        existing.count += 1;
        existing.username = username; // keep username in sync
    } else {
        board.set(userId, { username, count: 1 });
    }
}

function getLeaderboard(roomId) {
    const board = roomLeaderboards.get(roomId);
    if (!board || board.size === 0) return [];

    const sorted = [...board.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([userId, { username, count }], i) => ({
            userId,
            username,
            count,
            rank: i + 1
        }));

    return sorted;
}

function getUserRank(roomId, userId) {
    const board = getLeaderboard(roomId);
    const entry = board.find(e => e.userId === userId);
    return entry || null;
}

function getTop3(roomId) {
    return getLeaderboard(roomId).slice(0, 3);
}

// Returns the new Top 3 array if it changed, or null if unchanged.
function updateAndCheckTop3(roomId) {
    const newTop3 = getTop3(roomId).map(e => e.userId);
    const oldTop3 = roomTop3Cache.get(roomId) || [];

    const changed = newTop3.length !== oldTop3.length ||
        newTop3.some((id, i) => id !== oldTop3[i]);

    if (changed) {
        roomTop3Cache.set(roomId, newTop3);
        return getTop3(roomId); // Return full objects
    }
    return null;
}

function getMsUntilReset() {
    const elapsed = Date.now() - lastResetTime;
    const interval = 60 * 60 * 1000; // 1 hour
    return Math.max(0, interval - elapsed);
}

function resetAllLeaderboards() {
    roomLeaderboards.clear();
    roomTop3Cache.clear();
    lastResetTime = Date.now();
}

// --- Scheduler ---

let resetTimer = null;

function initLeaderboardScheduler(io) {
    lastResetTime = Date.now();

    // Clear any existing timer (safety for hot reloads)
    if (resetTimer) clearInterval(resetTimer);

    resetTimer = setInterval(() => {
        resetAllLeaderboards();
        console.log('[Leaderboard] Hourly reset completed.');
        io.emit('leaderboard-reset');
    }, 60 * 60 * 1000); // Every hour
}

module.exports = {
    recordMessage,
    getLeaderboard,
    getUserRank,
    getTop3,
    updateAndCheckTop3,
    getMsUntilReset,
    resetAllLeaderboards,
    initLeaderboardScheduler
};
