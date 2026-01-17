const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const { formatMessage, storeMessage, getMessage, getRoomMessages, addReaction } = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers, getRoomUserCount, updateLastMessageTime } = require('./utils/users');
const { updateTrendingTopics, getTrendingTopics } = require('./utils/trending');
const config = require('./utils/config');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    maxHttpBufferSize: 3e6 // 3MB for image uploads
});

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'System';

// Standard rooms
const standardRooms = ['General', 'Tech', 'Music', 'Movies', 'Politics', 'Gaming'];

// API to get all rooms (Standard + Trending)
app.get('/api/rooms', (req, res) => {
    res.json({
        standard: standardRooms,
        trending: getTrendingTopics()
    });
});

// API to get config (for client-side)
app.get('/api/config', (req, res) => {
    res.json({
        rateLimitSeconds: config.rateLimitSeconds,
        reactionEmojis: config.reactionEmojis
    });
});

// Mock AI Update Loop (Every 30 seconds for demo purposes)
setInterval(() => {
    const newTopics = updateTrendingTopics();
    io.emit('rooms-updated', {
        standard: standardRooms,
        trending: newTopics
    });
}, 30000);

// Run when client connects
io.on('connection', socket => {
    socket.on('joinRoom', ({ username, room }) => {
        const user = userJoin(socket.id, username, room);

        socket.join(user.room);

        // Send message history to new user
        const history = getRoomMessages(user.room);
        history.forEach(msg => {
            socket.emit('message', msg);
        });

        // Welcome current user (system message)
        socket.emit('message', formatMessage(botName, 'Welcome! Stay anonymous.', user.room, '#888'));

        // Broadcast when a user connects
        socket.broadcast
            .to(user.room)
            .emit('message', formatMessage(botName, 'A new user joined', user.room, '#888'));

        // Send user count (not names)
        io.to(user.room).emit('roomUsers', {
            room: user.room,
            count: getRoomUserCount(user.room),
            userColor: user.color // Send this user's color
        });
    });

    // Listen for chatMessage
    socket.on('chatMessage', ({ text, replyTo, replyToText }) => {
        const user = getCurrentUser(socket.id);

        if (user) {
            // Rate limiting check
            const now = Date.now();
            const timeSinceLastMsg = (now - user.lastMessageTime) / 1000;

            if (timeSinceLastMsg < config.rateLimitSeconds) {
                socket.emit('error-message', `Please wait ${Math.ceil(config.rateLimitSeconds - timeSinceLastMsg)}s before sending another message.`);
                return;
            }

            updateLastMessageTime(socket.id);

            const message = formatMessage(user.username, text, user.room, user.color, replyTo, replyToText, null);
            storeMessage(message, io);
            io.to(user.room).emit('message', message);
        }
    });

    // Listen for image messages
    socket.on('chatImage', ({ imageData, replyTo, replyToText }) => {
        const user = getCurrentUser(socket.id);

        if (user) {
            // Rate limiting check
            const now = Date.now();
            const timeSinceLastMsg = (now - user.lastMessageTime) / 1000;

            if (timeSinceLastMsg < config.rateLimitSeconds) {
                socket.emit('error-message', `Please wait ${Math.ceil(config.rateLimitSeconds - timeSinceLastMsg)}s before sending.`);
                return;
            }

            // Size check
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

    // Listen for reactions
    socket.on('addReaction', ({ messageId, emoji }) => {
        const user = getCurrentUser(socket.id);
        if (user) {
            const updatedMsg = addReaction(messageId, emoji);
            if (updatedMsg) {
                io.to(user.room).emit('reactionAdded', {
                    messageId,
                    reactions: updatedMsg.reactions
                });
            }
        }
    });

    // Runs when client disconnects
    socket.on('disconnect', () => {
        const user = userLeave(socket.id);

        if (user) {
            io.to(user.room).emit('message', formatMessage(botName, 'A user left', user.room, '#888'));

            // Send updated user count
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                count: getRoomUserCount(user.room)
            });
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
