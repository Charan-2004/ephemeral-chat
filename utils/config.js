// Centralized configuration for moderator-controlled settings
module.exports = {
    // Message auto-delete time in milliseconds (default: 2 minutes for demo)
    messageTTL: 2 * 60 * 1000,

    // Rate limit: minimum seconds between messages per user
    rateLimitSeconds: 3,

    // Maximum image size in bytes (2MB)
    maxImageSize: 2 * 1024 * 1024,

    // Available reaction emojis
    reactionEmojis: ['👍', '❤️', '😂', '😮', '😢', '🔥']
};
