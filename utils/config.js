// Centralized configuration for moderator-controlled settings
module.exports = {
    // Message auto-delete time in milliseconds (default: 0 for never delete)
    messageTTL: 0,

    // Rate limit: minimum seconds between messages per user
    rateLimitSeconds: 3,

    // Maximum image size in bytes (500KB)
    maxImageSize: 5 * 1024 * 1024,

    // Maximum document size in bytes (50MB)
    maxDocSize: 50 * 1024 * 1024,

    // Available reaction emojis
    reactionEmojis: ['\u{1F44D}', '\u{1F525}', '\u{1F602}', '\u{1F622}', '\u{1F62E}', '\u{1F44F}'],

    // --- Limits (previously hardcoded in server.js) ---

    // Maximum number of custom rooms allowed globally
    maxCustomRooms: 100,

    // Cooldown between room creation per socket (seconds)
    roomCreateCooldownSeconds: 10,

    // Reaction rate limit: sliding window duration (ms)
    reactionWindowMs: 5000,

    // Reaction rate limit: max reactions per window
    reactionWindowMax: 5,

    // Max age of empty custom rooms before cleanup (ms) - 5 minutes
    customRoomMaxAgeMs: 5 * 60 * 1000
};
