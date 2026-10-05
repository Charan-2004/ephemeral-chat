const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const messages = new Map();
const roomIndex = new Map(); // room -> Set<messageId> for O(1) room lookups
const messageSizes = new Map();
const MAX_STORED_MESSAGE_COUNT = 5000;
const MAX_STORED_MESSAGE_BYTES = 160 * 1024 * 1024;
let storedMessageBytes = 0;

function estimateMessageBytes(message) {
    const fields = [message.text, message.imageData, message.docData, message.docName, message.replyToText];
    return fields.reduce((total, value) => total + (typeof value === 'string' ? Buffer.byteLength(value, 'utf8') * 2 : 0), 512);
}

function formatMessage(username, text, room, color = null, replyTo = null, replyToText = null, imageData = null, senderId = null, userId = null) {
    return {
        id: uuidv4(),
        senderId,
        userId: userId || senderId,
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
    const size = estimateMessageBytes(message);
    if (size > MAX_STORED_MESSAGE_BYTES) return false;
    messages.set(message.id, message);
    messageSizes.set(message.id, size);
    storedMessageBytes += size;
    if (!roomIndex.has(message.room)) roomIndex.set(message.room, new Set());
    roomIndex.get(message.room).add(message.id);
    while (messages.size > MAX_STORED_MESSAGE_COUNT || storedMessageBytes > MAX_STORED_MESSAGE_BYTES) {
        const oldestId = messages.keys().next().value;
        if (oldestId === undefined) break;
        deleteMessage(oldestId, io);
    }
    return true;
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
        const roomManager = require('./roomManager');
        if (roomManager.getPinnedMessage()?.id === id) {
            roomManager.setPinnedMessage(null);
            if (io) io.emit('message-unpinned');
        }
        const roomSet = roomIndex.get(msg.room);
        if (roomSet) roomSet.delete(id);
        storedMessageBytes -= messageSizes.get(id) || 0;
        messageSizes.delete(id);
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
