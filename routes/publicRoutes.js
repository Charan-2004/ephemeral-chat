const express = require('express');
const router = express.Router();
const { getPublicRooms } = require('../utils/roomManager');
const { getRoomUserCount } = require('../utils/users');
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
    const io = req.app.get('io');
    res.json({ count: io.engine.clientsCount });
});

// GET /api/config
router.get('/config', (req, res) => {
    res.json({
        rateLimitSeconds: config.rateLimitSeconds,
        reactionEmojis: config.reactionEmojis
    });
});

module.exports = router;
