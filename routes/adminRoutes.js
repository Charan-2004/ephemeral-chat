const express = require('express');
const router = express.Router();
const { isAdmin, getAdminAccounts, createSession } = require('../utils/adminAuth');
const { getRooms, findRoom, addRoom, removeRoom, generateUniqueRoomId, getPublicRooms, getPinnedMessage, setPinnedMessage, broadcastRoomCounts } = require('../utils/roomManager');
const { getRoomUserCount, getRoomUsers, userLeave } = require('../utils/users');
const { getMessage, getRoomMessages, deleteMessage } = require('../utils/messages');
const { enableBots, disableBots, getBotStatus } = require('../utils/botEngine');
const config = require('../utils/config');

// Login
router.post('/login', (req, res) => {
    const { username, password, secret } = req.body;
    const admins = getAdminAccounts();
    const matchedAdmin = admins.find(a =>
        a.username === username &&
        a.password === password &&
        a.secret === secret
    );

    if (matchedAdmin) {
        const token = createSession(username);
        return res.json({ success: true, token, username });
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

// Stats
router.get('/stats', isAdmin, (req, res) => {
    const rooms = getRooms();
    const io = req.app.get('io');
    const totalRooms = rooms.length;
    const onlineRooms = rooms.filter(r => getRoomUserCount(r.id || r.name) > 0).length;
    const users = io.engine.clientsCount + getBotStatus().botCount;
    res.json({ users, onlineRooms, totalRooms });
});

// Manage Rooms
router.post('/rooms', isAdmin, (req, res) => {
    const { action, roomName, reason } = req.body;
    const io = req.app.get('io');

    if (action === 'create') {
        if (typeof roomName !== 'string' || !roomName.trim() || roomName.trim().length > 30) {
            return res.status(400).json({ error: 'Room name must be between 1 and 30 characters.' });
        }
        const normalizedName = roomName.trim();
        if (getRooms().some(room =>
            room.name.toLowerCase() === normalizedName.toLowerCase() ||
            room.id.toLowerCase() === normalizedName.toLowerCase()
        )) {
            return res.status(409).json({ error: 'A room with that name already exists.' });
        }
        addRoom({
            name: normalizedName,
            id: generateUniqueRoomId(),
            isCustom: false,
            isPrivate: false,
            password: null,
            locked: false,
            reason: ''
        });
        io.emit('rooms-updated', getPublicRooms());
    } else if (action === 'delete') {
        const room = findRoom(roomName);
        if (!room) return res.status(404).json({ error: 'Room not found.' });
        const hadPinnedMessage = getPinnedMessage() && getRoomMessages(room.id).some(message => message.id === getPinnedMessage().id);
        getRoomUsers(room.id).forEach(user => {
            const memberSocket = io.sockets?.sockets?.get(user.id);
            if (memberSocket) {
                memberSocket.leave(room.id);
                memberSocket.emit('room-not-found');
            }
            userLeave(user.id);
        });
        getRoomMessages(room.id).forEach(message => deleteMessage(message.id, null));
        if (hadPinnedMessage) io.emit('message-unpinned');
        removeRoom(room.id);
        io.emit('rooms-updated', getPublicRooms());
        broadcastRoomCounts(io);
    } else if (action === 'lock') {
        const room = findRoom(roomName);
        if (!room) return res.status(404).json({ error: 'Room not found.' });
        room.locked = true;
        room.reason = typeof reason === 'string' ? reason.slice(0, 200) : 'Room locked by moderator';
        io.emit('rooms-updated', getPublicRooms());
    } else if (action === 'unlock') {
        const room = findRoom(roomName);
        if (!room) return res.status(404).json({ error: 'Room not found.' });
        room.locked = false;
        room.reason = '';
        io.emit('rooms-updated', getPublicRooms());
    } else {
        return res.status(400).json({ error: 'Invalid room action.' });
    }

    res.json({ success: true, currentRooms: getRooms() });
});

// Config Update
router.post('/config', isAdmin, (req, res) => {
    const { ttl, spam } = req.body;
    if (ttl !== undefined) {
        const ttlSeconds = Number(ttl);
        if (!Number.isInteger(ttlSeconds) || ttlSeconds < 0 || ttlSeconds > 604800) {
            return res.status(400).json({ error: 'TTL must be an integer from 0 to 604800 seconds.' });
        }
        config.ttlSeconds = ttlSeconds;
    }
    if (spam !== undefined) {
        const rateLimitSeconds = Number(spam);
        if (!Number.isInteger(rateLimitSeconds) || rateLimitSeconds < 1 || rateLimitSeconds > 60) {
            return res.status(400).json({ error: 'Message rate limit must be an integer from 1 to 60 seconds.' });
        }
        config.rateLimitSeconds = rateLimitSeconds;
    }
    res.json({ success: true });
});

// Delete Message
router.post('/messages/delete', isAdmin, (req, res) => {
    const { messageId } = req.body;
    const io = req.app.get('io');
    if (!getMessage(messageId)) return res.status(404).json({ error: 'Message not found.' });
    const wasPinned = getPinnedMessage()?.id === messageId;
    deleteMessage(messageId, null);
    if (wasPinned) io.emit('message-unpinned');
    io.emit('message-deleted', messageId);
    res.json({ success: true });
});

// Pin Message
router.post('/messages/pin', isAdmin, (req, res) => {
    const { messageId, text, username } = req.body;
    const io = req.app.get('io');
    const msg = getMessage(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    const room = findRoom(msg.room);
    if (msg.isWhisper || !room || room.isPrivate) {
        return res.status(403).json({ error: 'Private messages cannot be pinned publicly.' });
    }
    const pinData = { id: msg.id, text: msg.text || (msg.docData ? '[Document]' : '[Image]'), username: msg.username || username || 'Moderator' };
    setPinnedMessage(pinData, msg);
    io.emit('message-pinned', pinData);
    res.json({ success: true });
});

// Unpin Message
router.post('/messages/unpin', isAdmin, (req, res) => {
    const io = req.app.get('io');
    setPinnedMessage(null);
    io.emit('message-unpinned');
    res.json({ success: true });
});

// Bot Management
router.post('/bots', isAdmin, (req, res) => {
    const { action } = req.body;
    const rooms = getRooms();
    if (action === 'enable') {
        return res.json(enableBots(rooms));
    } else if (action === 'disable') {
        return res.json(disableBots(rooms));
    } else if (action === 'status') {
        return res.json(getBotStatus());
    }
    res.status(400).json({ error: 'Invalid action' });
});

module.exports = router;
