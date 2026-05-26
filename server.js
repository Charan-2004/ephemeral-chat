require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { formatMessage, storeMessage, getMessage, getRoomMessages, addReaction, cleanExpiredMessages, deleteMessage } = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers, getRoomUserCount, updateLastMessageTime } = require('./utils/users');
const config = require('./utils/config');
const { initBots, enableBots, disableBots, getBotStatus, handleRealUserMessage, isBot } = require('./utils/botEngine');
const { isMessageSafe } = require('./utils/moderation');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    maxHttpBufferSize: 3e6
});

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "html2canvas.hertzen.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"], // Socket.io defaults to self
        },
    },
}));

// Performance
app.use(compression());

// Admin Subdomain Middleware
app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (host.startsWith('admin.')) {
        if (req.path === '/' || req.path === '/index.html') {
            return res.sendFile(path.join(__dirname, 'public/admin/index.html'));
        }
    }
    next();
});

// Static folder with conservative caching (updates propagate fast)
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '5m',
    etag: true,
    lastModified: true,
    setHeaders: (res, filepath) => {
        // Images/fonts: moderate cache with revalidation
        if (filepath.match(/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate'); // 1 day
        }
        // HTML: always revalidate
        if (filepath.match(/\.html$/)) {
            res.setHeader('Cache-Control', 'no-cache');
        }
        // CSS/JS: short cache
        if (filepath.match(/\.(css|js)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 min
        }
    }
}));
app.use(express.json());

const botName = 'System';


// Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply to API routes
app.use('/api/', apiLimiter);

// Login Specific Rate Limiter (Max 5 attempts per 15 minutes)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});
app.use('/api/admin/login', loginLimiter);

// Room Management
let rooms = [
    { name: 'General', id: 'General', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Tech', id: 'Tech', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Music', id: 'Music', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Movies', id: 'Movies', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Politics', id: 'Politics', isCustom: false, isPrivate: false, locked: false, reason: '' },
    { name: 'Gaming', id: 'Gaming', isCustom: false, isPrivate: false, locked: false, reason: '' }
];

// Room ID Generator: 8-character string with exactly 4 letters (uppercase) and 4 numbers
function generateRoomId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let id = [];
    
    // Generate exactly 4 letters and 4 numbers to satisfy total 8 length and at least 3 letters/3 numbers
    for (let i = 0; i < 4; i++) {
        id.push(letters.charAt(Math.floor(Math.random() * letters.length)));
        id.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
    }
    
    // Shuffle the generated array
    for (let i = id.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [id[i], id[j]] = [id[j], id[i]];
    }
    return id.join('');
}

function generateUniqueRoomId(existingRooms) {
    let attempts = 0;
    while (attempts < 1000) {
        const id = generateRoomId();
        if (!existingRooms.find(r => r.id === id || r.name === id)) {
            return id;
        }
        attempts++;
    }
    throw new Error('Failed to generate unique Room ID');
}

// Store current pinned message state
let pinnedMessage = null;

// API: Get Rooms
app.get('/api/rooms', (req, res) => {
    // Only return general and custom public rooms, with live user counts
    const publicRooms = rooms.filter(r => !r.isPrivate).map(r => ({
        ...r,
        userCount: getRoomUserCount(r.id)
    }));
    res.json(publicRooms);
});

// API: Get Online Count
app.get('/api/online-count', (req, res) => {
    res.json({ count: io.engine.clientsCount });
});

// API: Get Config
app.get('/api/config', (req, res) => {
    res.json({
        rateLimitSeconds: config.rateLimitSeconds,
        reactionEmojis: config.reactionEmojis
    });
});

// Broadcast room user counts to all clients
function broadcastRoomCounts() {
    const counts = {};
    rooms.forEach(r => {
        counts[r.id] = getRoomUserCount(r.id);
    });
    io.emit('room-counts', counts);
}

// --- Admin API ---

// Store admin sessions with their username: Map<token, username>
const adminSessions = new Map();
const generateToken = () => require('uuid').v4();

// Parse admins from ENV. Format: ADMIN_ACCOUNTS=user1:pass1:secret1,user2:pass2:secret2
function getAdminAccounts() {
    if (process.env.ADMIN_ACCOUNTS) {
        return process.env.ADMIN_ACCOUNTS.split(',').map(item => {
            const [username, password, secret] = item.split(':');
            return {
                username: username.trim(),
                password: password.trim(),
                secret: secret ? secret.trim() : process.env.ADMIN_SECRET
            };
        });
    }
    return [{
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        secret: process.env.ADMIN_SECRET
    }];
}

const isAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token || !adminSessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.adminUsername = adminSessions.get(token);
    next();
};

// Login
app.post('/api/admin/login', (req, res) => {
    const { username, password, secret } = req.body;

    const admins = getAdminAccounts();
    const matchedAdmin = admins.find(a =>
        a.username === username &&
        a.password === password &&
        a.secret === secret
    );

    if (matchedAdmin) {
        const token = generateToken();
        adminSessions.set(token, username);
        return res.json({ success: true, token, username });
    }

    res.status(401).json({ error: 'Invalid credentials' });
});

// Stats
app.get('/api/admin/stats', isAdmin, (req, res) => {
    const totalRooms = rooms.length;
    const onlineRooms = rooms.filter(r => getRoomUserCount(r.id || r.name) > 0).length;
    const users = io.engine.clientsCount + getBotStatus().botCount;
    res.json({
        users,
        onlineRooms,
        totalRooms
    });
});

// Manage Rooms
app.post('/api/admin/rooms', isAdmin, (req, res) => {
    const { action, roomName, reason } = req.body;

    if (action === 'create') {
        if (!rooms.find(r => r.name === roomName)) {
            rooms.push({ name: roomName, locked: false, reason: '' });
            io.emit('rooms-updated', rooms);
        }
    } else if (action === 'delete') {
        rooms = rooms.filter(r => r.name !== roomName);
        io.emit('rooms-updated', rooms);
    } else if (action === 'lock') {
        const room = rooms.find(r => r.name === roomName);
        if (room) {
            room.locked = true;
            room.reason = reason || 'Room locked by moderator';
            io.emit('rooms-updated', rooms);
        }
    } else if (action === 'unlock') {
        const room = rooms.find(r => r.name === roomName);
        if (room) {
            room.locked = false;
            room.reason = '';
            io.emit('rooms-updated', rooms);
        }
    }

    res.json({ success: true, currentRooms: rooms });
});

// Config Update
app.post('/api/admin/config', isAdmin, (req, res) => {
    const { ttl, spam } = req.body;
    if (ttl !== undefined) config.ttlSeconds = parseInt(ttl);
    if (spam) config.rateLimitSeconds = parseInt(spam);
    res.json({ success: true });
});

// Moderate Messages
app.post('/api/admin/messages/delete', isAdmin, (req, res) => {
    const { messageId } = req.body;
    // Remove from in-memory store so it doesn't reappear on reload
    // We pass null for io to avoid emitting 'message-expired' event used for TTL
    deleteMessage(messageId, null);

    io.emit('message-deleted', messageId);
    res.json({ success: true });
});

app.post('/api/admin/messages/pin', isAdmin, (req, res) => {
    const { messageId, text, username } = req.body;
    const msg = getMessage(messageId);
    if (msg) msg.pinned = true;
    // Store pinned message state for new users
    pinnedMessage = { id: messageId, text, username };
    io.emit('message-pinned', { id: messageId, text, username });
    res.json({ success: true });
});

app.post('/api/admin/messages/unpin', isAdmin, (req, res) => {
    // Clear pinned message state
    pinnedMessage = null;
    io.emit('message-unpinned');
    res.json({ success: true });
});

// Bot Management
app.post('/api/admin/bots', isAdmin, (req, res) => {
    const { action } = req.body;
    if (action === 'enable') {
        const result = enableBots(rooms);
        return res.json(result);
    } else if (action === 'disable') {
        const result = disableBots(rooms);
        return res.json(result);
    } else if (action === 'status') {
        return res.json(getBotStatus());
    }
    res.status(400).json({ error: 'Invalid action' });
});

// --- End Admin API ---

// Cleanup Loop (every 5 seconds)
setInterval(() => {
    cleanExpiredMessages(io);
}, 5000);

// Cleanup idle empty custom rooms (every 60 seconds)
setInterval(() => {
    try {
        const now = Date.now();
        let changed = false;
        
        rooms = rooms.filter(r => {
            if (!r.isCustom) return true; // Keep default rooms
            
            const userCount = getRoomUserCount(r.id);
            // If room is empty and has existed for more than 5 minutes
            const ageMs = now - (r.createdAt || 0);
            if (userCount === 0 && ageMs > 5 * 60 * 1000) {
                changed = true;
                return false; // Filter it out (delete)
            }
            return true;
        });
        
        if (changed && io) {
            io.emit('rooms-updated', rooms.filter(r => !r.isPrivate));
            broadcastRoomCounts();
        }
    } catch (err) {
        console.error('Custom room cleanup error:', err);
    }
}, 60000);

io.on('connection', socket => {
    socket.on('joinRoom', ({ username, room, password }) => {
        // Resolve room by ID or name
        const roomConfig = rooms.find(r => r.id === room || r.name === room);
        if (!roomConfig) {
            socket.emit('error-message', 'Room not found.');
            socket.emit('room-not-found');
            return;
        }

        if (roomConfig.isPrivate) {
            if (!password || roomConfig.password !== password) {
                socket.emit('error-message', 'Incorrect room password.');
                socket.emit('incorrect-password');
                return;
            }
        }

        if (roomConfig.locked && username !== 'AdminMonitor') {
            socket.emit('error-message', `LOCKED: ${roomConfig.reason}`);
            socket.emit('room-locked');
            return;
        }

        // Input Validation
        if (!username || typeof username !== 'string' || username.trim().length === 0 || username.length > 20) {
            socket.emit('error-message', 'Invalid username (1-20 chars)');
            return;
        }

        const resolvedRoomId = roomConfig.id;

        // Leave previous room to prevent cross-room message leakage
        const existingUser = getCurrentUser(socket.id);
        if (existingUser) {
            socket.leave(existingUser.room);
            const prevRoom = existingUser.room;
            userLeave(socket.id);
            
            // Clean up custom room if it becomes empty
            const remainingCount = getRoomUserCount(prevRoom);
            const prevRoomConfig = rooms.find(r => r.id === prevRoom);
            if (remainingCount === 0 && prevRoomConfig && prevRoomConfig.isCustom) {
                const idx = rooms.findIndex(r => r.id === prevRoom);
                if (idx !== -1) {
                    rooms.splice(idx, 1);
                    io.emit('rooms-updated', rooms.filter(r => !r.isPrivate));
                }
            } else {
                io.to(prevRoom).emit('roomUsers', {
                    room: prevRoom,
                    count: getRoomUserCount(prevRoom),
                    users: getRoomUsers(prevRoom).map(u => ({ username: u.username, id: u.id, isBot: u.isBot, color: u.color }))
                });
            }
        }

        const user = userJoin(socket.id, username, resolvedRoomId);
        socket.join(user.room);

        const history = getRoomMessages(user.room);
        history.forEach(msg => socket.emit('message', msg));

        // Send current pinned message to new user if one exists
        if (pinnedMessage) {
            socket.emit('message-pinned', pinnedMessage);
        }

        // Welcome message with absolute unmonitored room content disclaimer
        const disclaimerText = 'Welcome to ChatHere! 👻 All rooms are unmonitored and user-directed. We assume zero responsibility for any room contents or user conduct. Messages vanish when the server restarts. Be kind!';
        socket.emit('message', formatMessage(botName, disclaimerText, user.room, '#888', null, null, null, 'system'));

        // Empty room experience: show conversation starters when user is alone
        const roomUserCount = getRoomUserCount(user.room);
        if (roomUserCount <= 1 && history.length === 0) {
            const starters = {
                'General': '💬 You\'re the first one here! Drop a message — people check in throughout the day. Try: "What\'s everyone up to today?"',
                'Tech': '💻 Quiet in here — be the spark! Try: "What tech are you most excited about in 2026?"',
                'Music': '🎵 Empty stage, your moment! Try: "Drop your current favorite song — go!"',
                'Movies': '🎬 No spoilers yet! Try: "What\'s the last movie that blew your mind?"',
                'Gaming': '🎮 Waiting for players... Try: "What are you playing right now?"',
                'Politics': '🗳️ The floor is yours! Try: "What issue do you think doesn\'t get enough attention?"'
            };
            const starter = starters[user.room] || '👋 You\'re the first one here! Say something — others will join soon.';
            socket.emit('message', formatMessage(botName, starter, user.room, '#888', null, null, null, 'system'));
            socket.emit('message', formatMessage(botName, '📲 Share this room: chathere.online/?room=' + user.room + ' — invite a friend!', user.room, '#888', null, null, null, 'system'));
        }

        io.to(user.room).emit('roomUsers', {
            room: user.room,
            count: getRoomUserCount(user.room),
            users: getRoomUsers(user.room).map(u => ({ username: u.username, id: u.id, isBot: u.isBot, color: u.color })),
            userColor: user.color
        });

        // Broadcast updated counts to all clients
        broadcastRoomCounts();
        io.emit('online-count', io.engine.clientsCount + getBotStatus().botCount);
    });

    // Typing Indicator (Throttle to max 1 emit per second)
    socket.on('typing', () => {
        const user = getCurrentUser(socket.id);
        if (user) {
            const now = Date.now();
            socket.lastTypingEmit = socket.lastTypingEmit || 0;
            if (now - socket.lastTypingEmit < 1000) return;
            socket.lastTypingEmit = now;
            socket.to(user.room).emit('user-typing', { username: user.username });
        }
    });

    socket.on('stop-typing', () => {
        const user = getCurrentUser(socket.id);
        if (user) {
            const now = Date.now();
            socket.lastStopTypingEmit = socket.lastStopTypingEmit || 0;
            if (now - socket.lastStopTypingEmit < 1000) return;
            socket.lastStopTypingEmit = now;
            socket.to(user.room).emit('user-stop-typing', { username: user.username });
        }
    });

    socket.on('chatMessage', ({ text, replyTo, replyToText }) => {
        if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 500) {
            return; // Ignore invalid messages
        }
        // Safety moderation: block racism, child abuse, terrorism
        if (!isMessageSafe(text)) {
            socket.emit('error-message', 'Your message was blocked for violating community guidelines.');
            return;
        }
        const user = getCurrentUser(socket.id);
        if (user) {
            const roomConfig = rooms.find(r => r.name === user.room);
            if (roomConfig && roomConfig.locked && user.username !== 'AdminMonitor') {
                socket.emit('error-message', 'This room is locked.');
                return;
            }

            const now = Date.now();
            if ((now - user.lastMessageTime) / 1000 < config.rateLimitSeconds) {
                socket.emit('error-message', `Please wait.`);
                return;
            }

            updateLastMessageTime(socket.id);
            const message = formatMessage(user.username, text, user.room, user.color, replyTo, replyToText, null, user.id);
            storeMessage(message, io);
            io.to(user.room).emit('message', message);
            // Notify all clients for unread badge tracking
            io.emit('room-message', { room: user.room });
            // Let bots potentially respond
            handleRealUserMessage(user.room, message);
        }
    });

    socket.on('adminChat', ({ text, room, username, token }) => {
        if (!token || !adminSessions.has(token)) {
            socket.emit('error-message', 'Unauthorized administrative action.');
            return;
        }
        const verifiedUsername = adminSessions.get(token) || username || 'Moderator';
        const message = formatMessage(verifiedUsername, text, room, '#ffd700', null, null, null, 'admin');
        message.isAdmin = true;
        storeMessage(message, io);
        io.to(room).emit('message', message);
        io.emit('room-message', { room });
    });

    socket.on('chatImage', ({ imageData, replyTo, replyToText }) => {
        const user = getCurrentUser(socket.id);
        if (user) {
            const now = Date.now();
            const timeDiff = (now - user.lastMessageTime) / 1000;
            if (timeDiff < config.rateLimitSeconds) {
                const waitTime = Math.ceil(config.rateLimitSeconds - timeDiff);
                socket.emit('error-message', `Please wait ${waitTime}s.`);
                return;
            }
            if (!imageData || typeof imageData !== 'string' || imageData.length > config.maxImageSize) {
                socket.emit('error-message', 'Image too large. Max 500KB.');
                return;
            }
            // Enforce basic image format regex validation
            if (!/^data:image\/(jpeg|png|gif|webp);base64,/.test(imageData)) {
                socket.emit('error-message', 'Invalid image format. Only JPEG, PNG, GIF, and WEBP supported.');
                return;
            }
            updateLastMessageTime(socket.id);
            const message = formatMessage(user.username, '', user.room, user.color, replyTo, replyToText, imageData, user.id);
            storeMessage(message, io);
            io.to(user.room).emit('message', message);
            io.emit('room-message', { room: user.room });
        }
    });

    socket.on('addReaction', ({ messageId, emoji }) => {
        const user = getCurrentUser(socket.id);
        if (user) {
            // Reaction rate limit: sliding window of max 5 reactions per 5 seconds
            const now = Date.now();
            socket.reactionWindow = socket.reactionWindow || [];
            socket.reactionWindow = socket.reactionWindow.filter(t => now - t < 5000);
            if (socket.reactionWindow.length >= 5) {
                socket.emit('error-message', 'Too many reactions. Slow down.');
                return;
            }
            socket.reactionWindow.push(now);

            const updatedMsg = addReaction(messageId, emoji);
            if (updatedMsg) {
                io.to(user.room).emit('reactionAdded', { messageId, reactions: updatedMsg.reactions });
            }
        }
    });

    // Create custom public or private rooms
    socket.on('createRoom', ({ roomName, isPrivate, password }) => {
        try {
            // Enforce Global Limit of max 100 custom rooms
            const MAX_CUSTOM_ROOMS = 100;
            const currentCustomCount = rooms.filter(r => r.isCustom).length;
            if (currentCustomCount >= MAX_CUSTOM_ROOMS) {
                socket.emit('error-message', 'Global limit of custom rooms reached. Try again later.');
                return;
            }

            // Enforce Rate-Limiting: Max 1 room every 10 seconds per socket
            const now = Date.now();
            socket.lastRoomCreatedTime = socket.lastRoomCreatedTime || 0;
            const elapsed = (now - socket.lastRoomCreatedTime) / 1000;
            if (elapsed < 10) {
                socket.emit('error-message', `Please wait ${Math.ceil(10 - elapsed)}s to create another room.`);
                return;
            }
            socket.lastRoomCreatedTime = now;

            const roomId = generateUniqueRoomId(rooms);
            const newRoom = {
                name: roomName ? roomName.trim().substring(0, 30) : `Room ${roomId}`,
                id: roomId,
                isCustom: true,
                isPrivate: !!isPrivate,
                password: isPrivate ? password : null,
                locked: false,
                reason: '',
                createdAt: Date.now() // Track creation time for cleanup
            };
            rooms.push(newRoom);
            socket.emit('roomCreated', { roomId, roomName: newRoom.name });
            
            // Broadcast updated rooms list to public users if public
            if (!isPrivate) {
                io.emit('rooms-updated', rooms.filter(r => !r.isPrivate));
                broadcastRoomCounts();
            }
        } catch (err) {
            socket.emit('error-message', 'Failed to create room. Please try again.');
        }
    });

    socket.on('disconnect', () => {
        const user = userLeave(socket.id);
        if (user) {
            // Clean up custom room if it becomes empty
            const remainingCount = getRoomUserCount(user.room);
            const prevRoomConfig = rooms.find(r => r.id === user.room);
            if (remainingCount === 0 && prevRoomConfig && prevRoomConfig.isCustom) {
                const idx = rooms.findIndex(r => r.id === user.room);
                if (idx !== -1) {
                    rooms.splice(idx, 1);
                    io.emit('rooms-updated', rooms.filter(r => !r.isPrivate));
                }
            } else {
                io.to(user.room).emit('roomUsers', {
                    room: user.room,
                    count: getRoomUserCount(user.room),
                    users: getRoomUsers(user.room).map(u => ({ username: u.username, id: u.id, isBot: u.isBot, color: u.color }))
                });
            }
            broadcastRoomCounts();
        }
        io.emit('online-count', io.engine.clientsCount + getBotStatus().botCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initBots(io, rooms);
});
