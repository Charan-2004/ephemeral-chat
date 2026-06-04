// Leaderboard: tracks per-room message counts and resets every hour.

// roomId -> Map(username -> count)
const roomLeaderboards = new Map();

// Timestamp of last reset (used to compute countdown on the client)
let lastResetTime = Date.now();

// Cache of the current Top 3 per room (for change detection)
const roomTop3Cache = new Map(); // roomId -> [username1, username2, username3]

// --- Core Operations ---

function recordMessage(roomId, username) {
    if (!roomLeaderboards.has(roomId)) {
        roomLeaderboards.set(roomId, new Map());
    }
    const board = roomLeaderboards.get(roomId);
    board.set(username, (board.get(username) || 0) + 1);
}

function getLeaderboard(roomId) {
    const board = roomLeaderboards.get(roomId);
    if (!board || board.size === 0) return [];

    const sorted = [...board.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([username, count], i) => ({
            username,
            count,
            rank: i + 1
        }));

    return sorted;
}

function getUserRank(roomId, username) {
    const board = getLeaderboard(roomId);
    const entry = board.find(e => e.username === username);
    return entry || null;
}

function getTop3(roomId) {
    return getLeaderboard(roomId).slice(0, 3);
}

// Returns the new Top 3 array if it changed, or null if unchanged.
function updateAndCheckTop3(roomId) {
    const newTop3 = getTop3(roomId).map(e => e.username);
    const oldTop3 = roomTop3Cache.get(roomId) || [];

    const changed = newTop3.length !== oldTop3.length ||
        newTop3.some((u, i) => u !== oldTop3[i]);

    if (changed) {
        roomTop3Cache.set(roomId, newTop3);
        return getTop3(roomId); // Return full objects with username, count, rank
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
