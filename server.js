require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const { formatMessage, storeMessage, getMessage, getRoomMessages, addReaction, cleanExpiredMessages, deleteMessage } = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers, getRoomUserCount, updateLastMessageTime } = require('./utils/users');
const config = require('./utils/config');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    maxHttpBufferSize: 3e6
});

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

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const botName = 'System';

// Room Management
let rooms = [
    { name: 'General', locked: false, reason: '' },
    { name: 'Tech', locked: false, reason: '' },
    { name: 'Music', locked: false, reason: '' },
    { name: 'Movies', locked: false, reason: '' },
    { name: 'Politics', locked: false, reason: '' },
    { name: 'Gaming', locked: false, reason: '' }
];

// API: Get Rooms
app.get('/api/rooms', (req, res) => {
    res.json(rooms);
});

// API: Get Config
app.get('/api/config', (req, res) => {
    res.json({
        rateLimitSeconds: config.rateLimitSeconds,
        reactionEmojis: config.reactionEmojis
    });
});

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
    res.json({
        users: io.engine.clientsCount,
        activeRooms: rooms.length
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
    io.emit('message-pinned', { id: messageId, text, username });
    res.json({ success: true });
});

app.post('/api/admin/messages/unpin', isAdmin, (req, res) => {
    io.emit('message-unpinned');
    res.json({ success: true });
});

// --- End Admin API ---

// Cleanup Loop (every 5 seconds)
setInterval(() => {
    cleanExpiredMessages(io);
}, 5000);

io.on('connection', socket => {
    socket.on('joinRoom', ({ username, room }) => {
        const roomConfig = rooms.find(r => r.name === room);
        if (roomConfig && roomConfig.locked && username !== 'AdminMonitor') {
            socket.emit('error-message', `LOCKED: ${roomConfig.reason}`);
            socket.emit('room-locked');
            return;
        }

        const user = userJoin(socket.id, username, room);
        socket.join(user.room);

        const history = getRoomMessages(user.room);
        history.forEach(msg => socket.emit('message', msg));

        socket.emit('message', formatMessage(botName, 'Welcome! Stay anonymous.', user.room, '#888'));

        socket.broadcast.to(user.room)
            .emit('message', formatMessage(botName, 'A new user joined', user.room, '#888'));

        io.to(user.room).emit('roomUsers', {
            room: user.room,
            count: getRoomUserCount(user.room),
            userColor: user.color
        });
    });

    socket.on('chatMessage', ({ text, replyTo, replyToText }) => {
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
            const message = formatMessage(user.username, text, user.room, user.color, replyTo, replyToText, null);
            storeMessage(message, io);
            io.to(user.room).emit('message', message);
        }
    });

    socket.on('adminChat', ({ text, room, username }) => {
        const senderName = username || 'Moderator';
        const message = formatMessage(senderName, text, room, '#ffd700', null, null, null);
        message.isAdmin = true;
        storeMessage(message, io);
        io.to(room).emit('message', message);
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
            if (imageData.length > config.maxImageSize) {
                socket.emit('error-message', 'Image too large. Max 2MB.');
                return;
            }
            updateLastMessageTime(socket.id);
            const message = formatMessage(user.username, '', user.room, user.color, replyTo, replyToText, imageData);
            storeMessage(message, io);
            io.to(user.room).emit('message', message);
        }
    });

    socket.on('addReaction', ({ messageId, emoji }) => {
        const user = getCurrentUser(socket.id);
        if (user) {
            const updatedMsg = addReaction(messageId, emoji);
            if (updatedMsg) {
                io.to(user.room).emit('reactionAdded', { messageId, reactions: updatedMsg.reactions });
            }
        }
    });

    socket.on('disconnect', () => {
        const user = userLeave(socket.id);
        if (user) {
            io.to(user.room).emit('message', formatMessage(botName, 'A user left', user.room, '#888'));
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                count: getRoomUserCount(user.room)
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
