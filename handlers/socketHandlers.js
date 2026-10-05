const { formatMessage, storeMessage, addReaction, getMessage, getRoomMessages } = require('../utils/messages');
const eventsEngine = require('../utils/eventsEngine');
const { userJoin, getCurrentUser, userLeave, getRoomUsers, getRoomUserCount, updateLastMessageTime } = require('../utils/users');
const { isMessageSafe } = require('../utils/moderation');
const { handleRealUserMessage, getBotStatus } = require('../utils/botEngine');
const { verifySession } = require('../utils/adminAuth');
const { getRooms, findRoom, addRoom, generateUniqueRoomId, tryCleanupRoom, getPinnedMessage, broadcastRoomCounts, getPublicRooms, emitRoomUsers } = require('../utils/roomManager');
const { recordMessage, getLeaderboard, getUserRank, getTop3, updateAndCheckTop3, getMsUntilReset } = require('../utils/leaderboard');
const config = require('../utils/config');
const { sendPushToAll } = require('../utils/pushNotifications');
const PRIVATE_JOIN_WINDOW_MS = 15 * 60 * 1000;
const PRIVATE_JOIN_MAX_ATTEMPTS = 10;
const privateJoinAttempts = new Map();

function decodedDataUrlByteLength(dataUrl) {
    const separator = dataUrl.indexOf(',');
    if (separator < 0) return -1;
    const base64 = dataUrl.slice(separator + 1);
    if (base64.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
        return -1;
    }
    return Buffer.byteLength(base64, 'base64');
}

function getWritableRoom(socket, user) {
    const roomConfig = findRoom(user.room);
    if (!roomConfig) {
        socket.emit('error-message', 'Room not found.');
        socket.emit('room-not-found');
        return null;
    }
    if (roomConfig.locked && !verifySession(socket.adminSessionToken)) {
        socket.emit('error-message', 'This room is locked.');
        return null;
    }
    return roomConfig;
}

function emitRoomActivity(io, roomConfig) {
    const event = { room: roomConfig.id };
    if (roomConfig.isPrivate) io.to(roomConfig.id).emit('room-message', event);
    else io.emit('room-message', event);
}

function canJoinPrivateRoom(socket, roomConfig, password) {
    const address = socket.handshake?.address || socket.conn?.remoteAddress || 'unknown';
    const key = `${address}:${roomConfig.id}`;
    const now = Date.now();
    let attempt = privateJoinAttempts.get(key);
    if (!attempt || now - attempt.windowStartedAt >= PRIVATE_JOIN_WINDOW_MS) {
        attempt = { windowStartedAt: now, failures: 0, blockedUntil: 0 };
    }
    if (attempt.blockedUntil > now) {
        privateJoinAttempts.set(key, attempt);
        return false;
    }
    if (typeof password === 'string' && password === roomConfig.password) {
        privateJoinAttempts.delete(key);
        return true;
    }
    attempt.failures += 1;
    if (attempt.failures >= PRIVATE_JOIN_MAX_ATTEMPTS) {
        attempt.blockedUntil = now + PRIVATE_JOIN_WINDOW_MS;
    }
    privateJoinAttempts.set(key, attempt);
    if (privateJoinAttempts.size > 10000) {
        for (const [attemptKey, value] of privateJoinAttempts) {
            if (now - value.windowStartedAt >= PRIVATE_JOIN_WINDOW_MS || (value.blockedUntil && value.blockedUntil <= now)) {
                privateJoinAttempts.delete(attemptKey);
            }
        }
    }
    return false;
}

module.exports = function registerSocketHandlers(io) {
    io.on('connection', socket => {

        // Geo tracking for globe feature

        socket.on('joinRoom', ({ username, room, password, adminToken }) => {
            // Resolve room by ID or name
            const roomConfig = findRoom(room);
            if (!roomConfig) {
                socket.emit('error-message', 'Room not found.');
                socket.emit('room-not-found');
                return;
            }

            if (roomConfig.isPrivate) {
                if (!canJoinPrivateRoom(socket, roomConfig, password)) {
                    socket.emit('error-message', 'Incorrect room password.');
                    socket.emit('incorrect-password');
                    return;
                }
            }

            const adminSession = verifySession(adminToken);
            if (roomConfig.locked && !adminSession) {
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
            socket.adminSessionToken = adminSession ? adminToken : null;

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
            history.forEach(msg => {
                if (msg.isWhisper) {
                    if (msg.userId === user.userId || msg.whisperRecipientUserId === user.userId) {
                        socket.emit('message', msg);
                    }
                } else {
                    socket.emit('message', msg);
                }
            });

            // Send current pinned message to new user if one exists
            const pinnedMessage = getPinnedMessage();
            if (pinnedMessage) {
                socket.emit('message-pinned', pinnedMessage);
            }

            // Welcome message
            const welcomeText = 'Welcome to ChatHere! \u{1F44B} Messages vanish when the server restarts. Be kind!';
            socket.emit('message', formatMessage('System', welcomeText, user.room, '#888', null, null, null, 'system'));

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

            // Send current leaderboard Top 3 for public rooms
            if (!roomConfig.isPrivate) {
                const top3 = getTop3(user.room);
                socket.emit('room-leaderboard-top3', top3);
            }

            // Broadcast updated counts to all clients
            broadcastRoomCounts(io);
            io.emit('online-count', io.engine.clientsCount);

            // Push notification milestone triggers
            const onlineNow = io.engine.clientsCount;
            if (onlineNow === 10 || onlineNow === 25 || onlineNow === 50 || onlineNow === 100) {
                sendPushToAll(
                    '\uD83D\uDD25 ChatHere is getting busy!',
                    onlineNow + ' people are online right now. Come join the conversation!',
                    '/'
                ).catch(() => {});
            }

            // Send current active event (DISABLED - bots deactivated)
            // const { activeEvent, nextEvent } = eventsEngine.getNextEventInfo();
            // if (activeEvent) {
            //     socket.emit('event-status', { active: true, ... });
            // } else if (nextEvent) {
            //     socket.emit('event-status', { active: false, ... });
            // }
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

        // Whisper Handler
        socket.on('whisper', ({ recipientUserId, text, replyTo, replyToText }) => {
            if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 500) {
                return;
            }
            if (!isMessageSafe(text)) {
                socket.emit('error-message', 'Your whisper was blocked for violating community guidelines.');
                return;
            }
            const user = getCurrentUser(socket.id);
            if (user) {
                if (!getWritableRoom(socket, user)) return;
                const now = Date.now();
                if ((now - user.lastMessageTime) / 1000 < config.rateLimitSeconds) {
                    socket.emit('error-message', 'Please wait.');
                    return;
                }
                updateLastMessageTime(socket.id);

                const roomUsers = getRoomUsers(user.room);
                const recipientInRoom = roomUsers.find(u => u.userId === recipientUserId);
                if (!recipientInRoom) {
                    socket.emit('error-message', 'That user is no longer in this room.');
                    return;
                }

                const message = formatMessage(user.username, text, user.room, user.color, replyTo, replyToText, null, user.id, user.userId);
                message.isWhisper = true;
                message.whisperRecipientUserId = recipientUserId;
                message.whisperRecipientUsername = recipientInRoom.username;

                storeMessage(message, io);

                const senderSockets = roomUsers.filter(u => u.userId === user.userId).map(u => u.id);
                const recipientSockets = roomUsers.filter(u => u.userId === recipientUserId).map(u => u.id);

                const targetSocketIds = new Set([...senderSockets, ...recipientSockets]);
                targetSocketIds.forEach(socketId => {
                    io.to(socketId).emit('message', message);
                });
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
                const roomConfig = getWritableRoom(socket, user);
                if (!roomConfig) return;

                const now = Date.now();
                if ((now - user.lastMessageTime) / 1000 < config.rateLimitSeconds) {
                    socket.emit('error-message', 'Please wait.');
                    return;
                }

                updateLastMessageTime(socket.id);
                const message = formatMessage(user.username, text, user.room, user.color, replyTo, replyToText, null, user.id, user.userId);
                storeMessage(message, io);
                io.to(user.room).emit('message', message);
                // Notify all clients for unread badge tracking
                emitRoomActivity(io, roomConfig);

                // Event message routing (DISABLED - bots deactivated)
                // if (user.room === 'General') {
                //     if (eventsEngine.triviaActive()) {
                //         eventsEngine.handleTriviaAnswer(user.username, user.userId, text);
                //     } else if (eventsEngine.storyActive()) {
                //         eventsEngine.handleStoryLine(user.username, text);
                //     } else if (eventsEngine.debateActive()) {
                //         eventsEngine.handleDebateComment(user.username, text);
                //     }
                // }
                // Let bots potentially respond (DISABLED)
                // handleRealUserMessage(user.room, message);

                // Leaderboard: record message for public rooms
                if (roomConfig && !roomConfig.isPrivate) {
                    recordMessage(user.room, user.userId, user.username);
                    const newTop3 = updateAndCheckTop3(user.room);
                    if (newTop3) {
                        io.to(user.room).emit('room-leaderboard-top3', newTop3);
                    }
                }
            }
        });

        socket.on('adminChat', ({ text, room, username, token, sendAsSystem }) => {
            const session = verifySession(token);
            if (!session) {
                socket.emit('error-message', 'Unauthorized administrative action.');
                return;
            }
            if (typeof text !== 'string' || text.trim().length === 0 || text.length > 500) {
                socket.emit('error-message', 'Admin messages must be between 1 and 500 characters.');
                return;
            }
            const roomConfig = findRoom(room);
            if (!roomConfig) {
                socket.emit('error-message', 'Room not found.');
                return;
            }
            room = roomConfig.id;
            const verifiedUsername = session.username || username || 'Moderator';
            if (sendAsSystem && verifiedUsername === 'system') {
                const message = formatMessage('System', text, room, '#888', null, null, null, 'system');
                storeMessage(message, io);
                io.to(room).emit('message', message);
            } else {
                const message = formatMessage(verifiedUsername, text, room, '#ffd700', null, null, null, 'admin');
                message.isAdmin = true;
                storeMessage(message, io);
                io.to(room).emit('message', message);
            }
            emitRoomActivity(io, roomConfig);
        });

        socket.on('chatImage', ({ imageData, replyTo, replyToText }) => {
            const user = getCurrentUser(socket.id);
            if (user) {
                const roomConfig = getWritableRoom(socket, user);
                if (!roomConfig) return;
                const now = Date.now();
                const timeDiff = (now - user.lastMessageTime) / 1000;
                if (timeDiff < config.rateLimitSeconds) {
                    const waitTime = Math.ceil(config.rateLimitSeconds - timeDiff);
                    socket.emit('error-message', `Please wait ${waitTime}s.`);
                    return;
                }
                if (!imageData || typeof imageData !== 'string') {
                    socket.emit('error-message', 'Image too large. Max 5MB.');
                    return;
                }
                // Enforce basic image format regex validation
                if (!/^data:image\/(jpeg|png|gif|webp);base64,/.test(imageData)) {
                    socket.emit('error-message', 'Invalid image format. Only JPEG, PNG, GIF, and WEBP supported.');
                    return;
                }
                const imageSize = decodedDataUrlByteLength(imageData);
                if (imageSize < 0 || imageSize > config.maxImageSize) {
                    socket.emit('error-message', 'Image too large or invalid. Max 5MB.');
                    return;
                }
                updateLastMessageTime(socket.id);
                const message = formatMessage(user.username, '', user.room, user.color, replyTo, replyToText, imageData, user.id, user.userId);
                storeMessage(message, io);
                io.to(user.room).emit('message', message);
                emitRoomActivity(io, roomConfig);

                // Leaderboard: record image message for public rooms
                if (roomConfig && !roomConfig.isPrivate) {
                    recordMessage(user.room, user.userId, user.username);
                    const newTop3 = updateAndCheckTop3(user.room);
                    if (newTop3) {
                        io.to(user.room).emit('room-leaderboard-top3', newTop3);
                    }
                }
            }
        });

        // --- Document Sharing ---
        socket.on('chatDocument', ({ docData, docName, docSize, replyTo, replyToText }) => {
            const user = getCurrentUser(socket.id);
            if (user) {
                const roomConfig = getWritableRoom(socket, user);
                if (!roomConfig) return;
                const now = Date.now();
                const timeDiff = (now - user.lastMessageTime) / 1000;
                if (timeDiff < config.rateLimitSeconds) {
                    const waitTime = Math.ceil(config.rateLimitSeconds - timeDiff);
                    socket.emit('error-message', `Please wait ${waitTime}s.`);
                    return;
                }
                if (!docData || typeof docData !== 'string') {
                    socket.emit('error-message', 'Document too large. Max 50MB.');
                    return;
                }
                // Validate document type
                const allowedDocTypes = /^data:(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation|zip|x-zip-compressed|x-rar-compressed|json|xml)|text\/(plain|csv|html|css|javascript|markdown));base64,/;
                if (!allowedDocTypes.test(docData)) {
                    socket.emit('error-message', 'Unsupported file type.');
                    return;
                }
                const documentSize = decodedDataUrlByteLength(docData);
                if (documentSize < 0 || documentSize > config.maxDocSize) {
                    socket.emit('error-message', 'Document too large or invalid. Max 50MB.');
                    return;
                }
                updateLastMessageTime(socket.id);
                const message = formatMessage(user.username, '', user.room, user.color, replyTo, replyToText, null, user.id, user.userId);
                message.docData = docData;
                message.docName = typeof docName === 'string' ? docName.slice(0, 255) : 'document';
                message.docSize = documentSize;
                storeMessage(message, io);
                io.to(user.room).emit('message', message);
                emitRoomActivity(io, roomConfig);

                // Leaderboard: record doc message for public rooms
                if (roomConfig && !roomConfig.isPrivate) {
                    recordMessage(user.room, user.userId, user.username);
                    const newTop3 = updateAndCheckTop3(user.room);
                    if (newTop3) {
                        io.to(user.room).emit('room-leaderboard-top3', newTop3);
                    }
                }
            }
        });

        socket.on('addReaction', ({ messageId, emoji }) => {
            const user = getCurrentUser(socket.id);
            if (user) {
                if (!getWritableRoom(socket, user)) return;
                // Reaction rate limit: sliding window
                const now = Date.now();
                socket.reactionWindow = socket.reactionWindow || [];
                socket.reactionWindow = socket.reactionWindow.filter(t => now - t < config.reactionWindowMs);
                if (socket.reactionWindow.length >= config.reactionWindowMax) {
                    socket.emit('error-message', 'Too many reactions. Slow down.');
                    return;
                }
                socket.reactionWindow.push(now);

                const targetMessage = getMessage(messageId);
                const updatedMsg = targetMessage && targetMessage.room === user.room &&
                    config.reactionEmojis.includes(emoji)
                    ? addReaction(messageId, emoji)
                    : null;
                if (updatedMsg) {
                    io.to(user.room).emit('reactionAdded', { messageId, reactions: updatedMsg.reactions });
                }
            }
        });

        // Leaderboard: client requests full leaderboard data
        socket.on('get-leaderboard', () => {
            const user = getCurrentUser(socket.id);
            if (!user) return;
            const roomConfig = findRoom(user.room);
            if (!roomConfig || roomConfig.isPrivate) return;

            const leaderboard = getLeaderboard(user.room);
            const myRank = getUserRank(user.room, user.userId);
            const msUntilReset = getMsUntilReset();

            socket.emit('leaderboard-data', {
                leaderboard: leaderboard.slice(0, 25), // Top 25
                myRank,
                msUntilReset
            });
        });

        // Create custom public or private rooms
        socket.on('createRoom', ({ roomName, isPrivate, password }) => {
            try {
                if (typeof roomName !== 'string' || roomName.trim().length > 30) {
                    socket.emit('error-message', 'Room name must be 30 characters or fewer.');
                    return;
                }
                if (isPrivate && (typeof password !== 'string' || password.length < 8 || password.length > 128)) {
                    socket.emit('error-message', 'Private room passwords must be between 8 and 128 characters.');
                    return;
                }
                const requestedName = roomName.trim();
                if (requestedName && getRooms().some(room =>
                    room.name.toLowerCase() === requestedName.toLowerCase() ||
                    room.id.toLowerCase() === requestedName.toLowerCase()
                )) {
                    socket.emit('error-message', 'A room with that name already exists.');
                    return;
                }
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
                const normalizedName = requestedName || `Room ${roomId}`;
                const newRoom = {
                    name: normalizedName,
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
            io.emit('online-count', io.engine.clientsCount);
        });
    });
};

