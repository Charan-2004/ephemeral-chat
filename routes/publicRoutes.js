const express = require('express');
const router = express.Router();
const { getPublicRooms } = require('../utils/roomManager');
const { getRoomUserCount } = require('../utils/users');
const { getRoomMessages } = require('../utils/messages');
const { getVapidPublicKey, addSubscription } = require('../utils/pushNotifications');
const config = require('../utils/config');

// GET /api/rooms
router.get('/rooms', (req, res) => {
    const publicRooms = getPublicRooms().map(r => ({
        ...r,
        userCount: getRoomUserCount(r.id)
    }));
    res.json(publicRooms);
});

// GET /api/online-count
router.get('/online-count', (req, res) => {
    try {
        const io = req.app.get('io');
        const count = (io && io.engine && typeof io.engine.clientsCount === 'number') ? io.engine.clientsCount : 0;
        res.json({ count });
    } catch (e) {
        res.json({ count: 0 });
    }
});

// GET /api/config
router.get('/config', (req, res) => {
    res.json({
        rateLimitSeconds: config.rateLimitSeconds,
        reactionEmojis: config.reactionEmojis
    });
});

// GET /api/push/vapid-public-key
router.get('/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
});

// POST /api/push/subscribe
router.post('/push/subscribe', (req, res) => {
    const subscription = req.body;
    if (!addSubscription(subscription)) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }
    res.status(201).json({ success: true });
});

// Helper: escape HTML for SSR page
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// GET /live - Delegated to liveRoute
const { createLivePage } = require('./liveRoute');
router.get('/live', (req, res) => createLivePage(req, res));

module.exports = router;
