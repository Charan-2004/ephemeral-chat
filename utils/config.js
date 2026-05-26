// Centralized configuration for moderator-controlled settings
module.exports = {
    // Message auto-delete time in milliseconds (default: 0 for never delete)
    messageTTL: 0,

    // Rate limit: minimum seconds between messages per user
    rateLimitSeconds: 3,

    // Maximum image size in bytes (500KB)
    maxImageSize: 500 * 1024,

    // Available reaction emojis
    reactionEmojis: ['👍', '❤️', '😂', '😮', '😢', '🔥']
};
