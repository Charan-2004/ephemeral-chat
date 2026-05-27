const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const messages = new Map();
const roomIndex = new Map(); // room -> Set<messageId> for O(1) room lookups

function formatMessage(username, text, room, color = null, replyTo = null, replyToText = null, imageData = null, senderId = null) {
    return {
        id: uuidv4(),
        senderId,
        username,
        text,
        room,
        color,
        replyTo,
        replyToText,
        imageData,
        reactions: {},
        time: new Date().toLocaleTimeString(),
        createdAt: Date.now()
    };
}

function storeMessage(message, io) {
    messages.set(message.id, message);
    if (!roomIndex.has(message.room)) roomIndex.set(message.room, new Set());
    roomIndex.get(message.room).add(message.id);
}

// Called periodically to clean up. TTL=0 means never delete.
function cleanExpiredMessages(io) {
    const ttl = (config.ttlSeconds !== undefined ? config.ttlSeconds * 1000 : config.messageTTL) || 0;
    if (ttl === 0) return; // Never delete mode

    const now = Date.now();

    for (const [id, msg] of messages.entries()) {
        if (msg.pinned) continue;
        if (now - msg.createdAt > ttl) {
            deleteMessage(id, io);
        }
    }
}

function deleteMessage(id, io) {
    if (messages.has(id)) {
        const msg = messages.get(id);
        const roomSet = roomIndex.get(msg.room);
        if (roomSet) roomSet.delete(id);
        messages.delete(id);
        if (io) {
            io.to(msg.room).emit('message-expired', id);
        }
    }
}

function getMessage(id) {
    return messages.get(id);
}

function getRoomMessages(room) {
    const ids = roomIndex.get(room);
    if (!ids || ids.size === 0) return [];
    const roomMessages = [];
    for (const id of ids) {
        const msg = messages.get(id);
        if (msg) roomMessages.push(msg);
    }
    return roomMessages.sort((a, b) => a.createdAt - b.createdAt);
}

function addReaction(messageId, emoji) {
    const msg = messages.get(messageId);
    if (msg) {
        if (!msg.reactions[emoji]) {
            msg.reactions[emoji] = 0;
        }
        msg.reactions[emoji]++;
        return msg;
    }
    return null;
}

module.exports = {
    formatMessage,
    storeMessage,
    deleteMessage,
    getMessage,
    getRoomMessages,
    addReaction,
    cleanExpiredMessages
};
