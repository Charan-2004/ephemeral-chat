const express = require('express');
const router = express.Router();
const { isAdmin, getAdminAccounts, createSession } = require('../utils/adminAuth');
const { getRooms, findRoom, addRoom, removeRoomByName, getPublicRooms, getPinnedMessage, setPinnedMessage } = require('../utils/roomManager');
const { getRoomUserCount } = require('../utils/users');
const { getMessage, deleteMessage } = require('../utils/messages');
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
        if (!findRoom(roomName)) {
            addRoom({ name: roomName, locked: false, reason: '' });
            io.emit('rooms-updated', getRooms());
        }
    } else if (action === 'delete') {
        removeRoomByName(roomName);
        io.emit('rooms-updated', getRooms());
    } else if (action === 'lock') {
        const room = findRoom(roomName);
        if (room) {
            room.locked = true;
            room.reason = reason || 'Room locked by moderator';
            io.emit('rooms-updated', getRooms());
        }
    } else if (action === 'unlock') {
        const room = findRoom(roomName);
        if (room) {
            room.locked = false;
            room.reason = '';
            io.emit('rooms-updated', getRooms());
        }
    }

    res.json({ success: true, currentRooms: getRooms() });
});

// Config Update
router.post('/config', isAdmin, (req, res) => {
    const { ttl, spam } = req.body;
    if (ttl !== undefined) config.ttlSeconds = parseInt(ttl);
    if (spam) config.rateLimitSeconds = parseInt(spam);
    res.json({ success: true });
});

// Delete Message
router.post('/messages/delete', isAdmin, (req, res) => {
    const { messageId } = req.body;
    const io = req.app.get('io');
    deleteMessage(messageId, null);
    io.emit('message-deleted', messageId);
    res.json({ success: true });
});

// Pin Message
router.post('/messages/pin', isAdmin, (req, res) => {
    const { messageId, text, username } = req.body;
    const io = req.app.get('io');
    const msg = getMessage(messageId);
    if (msg) msg.pinned = true;
    const pinData = { id: messageId, text, username };
    setPinnedMessage(pinData);
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
