const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const messages = new Map(); // Store messages: key=id, value=messageObject

function formatMessage(username, text, room, color = null, replyTo = null, replyToText = null, imageData = null) {
    return {
        id: uuidv4(),
        username,
        text,
        room,
        color,
        replyTo,       // ID of message being replied to
        replyToText,   // Text of message being replied to (for visibility to all)
        imageData,     // Base64 image data
        reactions: {}, // { emoji: count }
        time: new Date().toLocaleTimeString(),
        createdAt: Date.now()
    };
}

function storeMessage(message, io) {
    messages.set(message.id, message);

    // TTL DISABLED - Messages persist until server restart
    // To re-enable, uncomment below:
    // setTimeout(() => {
    //     deleteMessage(message.id, io);
    // }, config.messageTTL);
}

function deleteMessage(id, io) {
    if (messages.has(id)) {
        const msg = messages.get(id);
        messages.delete(id);

        // Notify clients in the room to remove the message from UI
        if (io) {
            io.to(msg.room).emit('message-expired', id);
        }
    }
}

function getMessage(id) {
    return messages.get(id);
}

// Get all messages for a room (for history)
function getRoomMessages(room) {
    const roomMessages = [];
    messages.forEach(msg => {
        if (msg.room === room) {
            roomMessages.push(msg);
        }
    });
    // Sort by creation time
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
    addReaction
};
