const { formatMessage, storeMessage, addReaction, getRoomMessages } = require('../utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers, getRoomUserCount, updateLastMessageTime } = require('../utils/users');
const { isMessageSafe } = require('../utils/moderation');
const { handleRealUserMessage, getBotStatus } = require('../utils/botEngine');
const { verifySession } = require('../utils/adminAuth');
const { getRooms, findRoom, addRoom, generateUniqueRoomId, tryCleanupRoom, getPinnedMessage, broadcastRoomCounts, getPublicRooms, emitRoomUsers } = require('../utils/roomManager');
const config = require('../utils/config');

module.exports = function registerSocketHandlers(io) {
    io.on('connection', socket => {

        socket.on('joinRoom', ({ username, room, password }) => {
            // Resolve room by ID or name
            const roomConfig = findRoom(room);
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

                // Unified cleanup: remove empty custom room, or update user list
                if (!tryCleanupRoom(prevRoom, io)) {
                    emitRoomUsers(io, prevRoom);
                }
            }

            const user = userJoin(socket.id, username, resolvedRoomId);
            socket.join(user.room);

            const history = getRoomMessages(user.room);
            history.forEach(msg => socket.emit('message', msg));

            // Send current pinned message to new user if one exists
            const pinnedMessage = getPinnedMessage();
            if (pinnedMessage) {
                socket.emit('message-pinned', pinnedMessage);
            }

            // Welcome message with disclaimer
            const disclaimerText = 'Welcome to ChatHere! \u{1F44B} All rooms are unmonitored and user-directed. We assume zero responsibility for any room contents or user conduct. Messages vanish when the server restarts. Be kind!';
            socket.emit('message', formatMessage('System', disclaimerText, user.room, '#888', null, null, null, 'system'));

            // Empty room experience: show conversation starters when user is alone
            const roomUserCount = getRoomUserCount(user.room);
            if (roomUserCount <= 1 && history.length === 0) {
                const starters = {
                    'General': '\u{1F44B} You\'re the first one here! Drop a message \u2014 people check in throughout the day. Try: "What\'s everyone up to today?"',
                    'Tech': '\u{1F44B} Quiet in here \u2014 be the spark! Try: "What tech are you most excited about in 2026?"',
                    'Music': '\u{1F3B5} Empty stage, your moment! Try: "Drop your current favorite song \u2014 go!"',
                    'Movies': '\u{1F3B5} No spoilers yet! Try: "What\'s the last movie that blew your mind?"',
                    'Gaming': '\u{1F3AE} Waiting for players... Try: "What are you playing right now?"',
                    'Politics': '\u{1F5F3}\u{FE0F} The floor is yours! Try: "What issue do you think doesn\'t get enough attention?"'
                };
                const starter = starters[user.room] || '\u{1F44B} You\'re the first one here! Say something \u2014 others will join soon.';
                socket.emit('message', formatMessage('System', starter, user.room, '#888', null, null, null, 'system'));
                socket.emit('message', formatMessage('System', '\u{1F4E2} Share this room: chathere.online/?room=' + user.room + ' \u2014 invite a friend!', user.room, '#888', null, null, null, 'system'));
            }

            if (roomConfig.isPrivate) {
                const joinMsg = formatMessage('System', `${username} joined the chat.`, user.room, '#888', null, null, null, 'system');
                storeMessage(joinMsg, io);
                io.to(user.room).emit('message', joinMsg);
            }

            emitRoomUsers(io, user.room, { userColor: user.color });

            // Broadcast updated counts to all clients
            broadcastRoomCounts(io);
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
            // Safety moderation
            if (!isMessageSafe(text)) {
                socket.emit('error-message', 'Your message was blocked for violating community guidelines.');
                return;
            }
            const user = getCurrentUser(socket.id);
            if (user) {
                const roomConfig = findRoom(user.room);
                if (roomConfig && roomConfig.locked && user.username !== 'AdminMonitor') {
                    socket.emit('error-message', 'This room is locked.');
                    return;
                }

                const now = Date.now();
                if ((now - user.lastMessageTime) / 1000 < config.rateLimitSeconds) {
                    socket.emit('error-message', 'Please wait.');
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
            const session = verifySession(token);
            if (!session) {
                socket.emit('error-message', 'Unauthorized administrative action.');
                return;
            }
            const verifiedUsername = session.username || username || 'Moderator';
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
                // Reaction rate limit: sliding window
                const now = Date.now();
                socket.reactionWindow = socket.reactionWindow || [];
                socket.reactionWindow = socket.reactionWindow.filter(t => now - t < config.reactionWindowMs);
                if (socket.reactionWindow.length >= config.reactionWindowMax) {
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
                const rooms = getRooms();
                const currentCustomCount = rooms.filter(r => r.isCustom).length;
                if (currentCustomCount >= config.maxCustomRooms) {
                    socket.emit('error-message', 'Global limit of custom rooms reached. Try again later.');
                    return;
                }

                // Rate limit: max 1 room per cooldown period per socket
                const now = Date.now();
                socket.lastRoomCreatedTime = socket.lastRoomCreatedTime || 0;
                const elapsed = (now - socket.lastRoomCreatedTime) / 1000;
                if (elapsed < config.roomCreateCooldownSeconds) {
                    socket.emit('error-message', `Please wait ${Math.ceil(config.roomCreateCooldownSeconds - elapsed)}s to create another room.`);
                    return;
                }
                socket.lastRoomCreatedTime = now;

                const roomId = generateUniqueRoomId();
                const newRoom = {
                    name: roomName ? roomName.trim().substring(0, 30) : `Room ${roomId}`,
                    id: roomId,
                    isCustom: true,
                    isPrivate: !!isPrivate,
                    password: isPrivate ? password : null,
                    locked: false,
                    reason: '',
                    createdAt: Date.now()
                };
                addRoom(newRoom);
                socket.emit('roomCreated', { roomId, roomName: newRoom.name });

                // Broadcast updated rooms list to public users if public
                if (!isPrivate) {
                    io.emit('rooms-updated', getPublicRooms());
                    broadcastRoomCounts(io);
                }
            } catch (err) {
                socket.emit('error-message', 'Failed to create room. Please try again.');
            }
        });

        socket.on('disconnect', () => {
            const user = userLeave(socket.id);
            if (user) {
                // Unified cleanup: remove empty custom room, or update user list
                if (!tryCleanupRoom(user.room, io)) {
                    emitRoomUsers(io, user.room);
                }
                broadcastRoomCounts(io);
            }
            io.emit('online-count', io.engine.clientsCount + getBotStatus().botCount);
        });
    });
};