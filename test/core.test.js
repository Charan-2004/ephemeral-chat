const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const adminAuth = require('../utils/adminAuth');
const messages = require('../utils/messages');
const roomManager = require('../utils/roomManager');
const users = require('../utils/users');

test('admin accounts fail closed when credentials are missing or incomplete', () => {
    const names = ['ADMIN_ACCOUNTS', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_SECRET'];
    const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
    try {
        names.forEach(name => delete process.env[name]);
        assert.deepEqual(adminAuth.getAdminAccounts(), []);

        process.env.ADMIN_ACCOUNTS = 'incomplete:password';
        assert.deepEqual(adminAuth.getAdminAccounts(), []);

        process.env.ADMIN_USERNAME = 'moderator';
        process.env.ADMIN_PASSWORD = 'password';
        process.env.ADMIN_SECRET = 'secret';
        delete process.env.ADMIN_ACCOUNTS;
        assert.deepEqual(adminAuth.getAdminAccounts(), [{ username: 'moderator', password: 'password', secret: 'secret' }]);
    } finally {
        names.forEach(name => {
            if (original[name] === undefined) delete process.env[name];
            else process.env[name] = original[name];
        });
    }
});

test('anonymous user identity is assigned from the server socket ID', () => {
    const user = users.userJoin('socket-owned-id', 'Alias', 'review-room', false, 'spoofed-id');
    try {
        assert.equal(user.userId, 'socket-owned-id');
    } finally {
        users.userLeave('socket-owned-id');
    }
});

test('message storage evicts its oldest entries at the configured count bound', () => {
    const room = 'message-bound-review-room';
    const first = messages.formatMessage('Alias', 'first', room);
    messages.storeMessage(first);

    for (let index = 1; index < 5000; index += 1) {
        messages.storeMessage(messages.formatMessage('Alias', 'message', room));
    }
    const newest = messages.formatMessage('Alias', 'newest', room);
    messages.storeMessage(newest);

    assert.equal(messages.getMessage(first.id), undefined);
    assert.ok(messages.getMessage(newest.id));
    assert.equal(messages.getRoomMessages(room).length, 5000);

    messages.getRoomMessages(room).forEach(message => messages.deleteMessage(message.id));
});

test('admin room creation initializes room IDs and does not broadcast private room data', async () => {
    const express = require('express');
    const adminRoutes = require('../routes/adminRoutes');
    const privateRoom = { name: 'review-private-room', id: 'REVIEW42', isPrivate: true, password: 'do-not-broadcast' };
    const emitted = [];
    roomManager.addRoom(privateRoom);

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.set('io', { emit: (...args) => emitted.push(args) });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');

    try {
        const token = adminAuth.createSession('review-admin');
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: token },
            body: JSON.stringify({ action: 'create', roomName: 'review-created-room' })
        });
        assert.equal(response.status, 200);
        const payload = await response.json();
        const createdRoom = payload.currentRooms.find(room => room.name === 'review-created-room');
        assert.ok(createdRoom.id);
        assert.equal(createdRoom.isPrivate, false);

        const roomUpdate = emitted.find(([event]) => event === 'rooms-updated');
        assert.ok(roomUpdate);
        assert.equal(roomUpdate[1].some(room => room.name === privateRoom.name), false);
        assert.equal(JSON.stringify(roomUpdate).includes(privateRoom.password), false);
    } finally {
        await new Promise(resolve => server.close(resolve));
        roomManager.removeRoom('REVIEW42');
        roomManager.removeRoomByName('review-created-room');
    }
});

test('login rejects an empty body when admin credentials are not configured', async () => {
    const express = require('express');
    const adminRoutes = require('../routes/adminRoutes');
    const names = ['ADMIN_ACCOUNTS', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_SECRET'];
    const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
    names.forEach(name => delete process.env[name]);

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        assert.equal(response.status, 401);
    } finally {
        await new Promise(resolve => server.close(resolve));
        names.forEach(name => {
            if (original[name] === undefined) delete process.env[name];
            else process.env[name] = original[name];
        });
    }
});

test('locked public rooms reject the display-name admin bypass', () => {
    const original = roomManager.findRoom('Tech').locked;
    roomManager.findRoom('Tech').locked = true;
    let onConnection;
    const io = {
        engine: { clientsCount: 1 },
        on(event, callback) { if (event === 'connection') onConnection = callback; },
        emit() {},
        to() { return { emit() {} }; }
    };
    require('../handlers/socketHandlers')(io);
    const socket = {
        id: 'review-locked-socket',
        events: new Map(),
        sent: [],
        on(event, callback) { this.events.set(event, callback); },
        emit(event, payload) { this.sent.push([event, payload]); },
        join() {},
        leave() {},
        to() { return { emit() {} }; }
    };
    try {
        onConnection(socket);
        socket.events.get('joinRoom')({ username: 'AdminMonitor', room: 'Tech' });
        assert.ok(socket.sent.some(([event]) => event === 'room-locked'));
        assert.equal(users.getCurrentUser(socket.id), null);
    } finally {
        roomManager.findRoom('Tech').locked = original;
        users.userLeave(socket.id);
    }
});

test('reactions cannot modify messages from another room', () => {
    let onConnection;
    const io = {
        engine: { clientsCount: 1 },
        on(event, callback) { if (event === 'connection') onConnection = callback; },
        emit() {},
        to() { return { emit() {} }; }
    };
    require('../handlers/socketHandlers')(io);
    const socket = {
        id: 'review-reaction-socket',
        events: new Map(),
        on(event, callback) { this.events.set(event, callback); },
        emit() {},
        join() {},
        leave() {},
        to() { return { emit() {} }; }
    };
    const message = messages.formatMessage('Other', 'belongs to Tech', 'Tech');
    messages.storeMessage(message);

    try {
        onConnection(socket);
        socket.events.get('joinRoom')({ username: 'Alias', room: 'General' });
        socket.events.get('addReaction')({ messageId: message.id, emoji: require('../utils/config').reactionEmojis[0] });
        assert.deepEqual(message.reactions, {});
    } finally {
        users.userLeave(socket.id);
        messages.deleteMessage(message.id);
    }
});

test('locked rooms reject text, image, document, and whisper sends from existing members', () => {
    let onConnection;
    const io = {
        engine: { clientsCount: 1 },
        on(event, callback) { if (event === 'connection') onConnection = callback; },
        emit() {},
        to() { return { emit() {} }; }
    };
    require('../handlers/socketHandlers')(io);
    const socket = {
        id: 'review-locked-existing-socket',
        events: new Map(),
        sent: [],
        on(event, callback) { this.events.set(event, callback); },
        emit(event, payload) { this.sent.push([event, payload]); },
        join() {},
        leave() {},
        to() { return { emit() {} }; }
    };
    const room = roomManager.findRoom('Tech');
    const original = room.locked;
    room.locked = false;
    try {
        onConnection(socket);
        socket.events.get('joinRoom')({ username: 'ExistingMember', room: 'Tech' });
        room.locked = true;

        socket.events.get('chatMessage')({ text: 'blocked text' });
        socket.events.get('whisper')({ recipientUserId: 'missing-user', text: 'blocked whisper' });
        socket.events.get('chatImage')({ imageData: 'invalid image' });
        socket.events.get('chatDocument')({ docData: 'invalid document' });

        assert.equal(socket.sent.filter(([event, payload]) => event === 'error-message' && payload === 'This room is locked.').length, 4);
    } finally {
        room.locked = original;
        users.userLeave(socket.id);
    }
});

test('private room message activity is emitted only to that room', () => {
    let onConnection;
    const globalEvents = [];
    const roomEvents = [];
    const privateRoom = { name: 'review-private-activity-room', id: 'PRIVACT1', isPrivate: true, password: 'review-password' };
    roomManager.addRoom(privateRoom);
    const io = {
        engine: { clientsCount: 1 },
        on(event, callback) { if (event === 'connection') onConnection = callback; },
        emit(...args) { globalEvents.push(args); },
        to(room) { return { emit(...args) { roomEvents.push([room, ...args]); } }; }
    };
    require('../handlers/socketHandlers')(io);
    const socket = {
        id: 'review-private-activity-socket',
        events: new Map(),
        on(event, callback) { this.events.set(event, callback); },
        emit() {},
        join() {},
        leave() {},
        to() { return { emit() {} }; }
    };
    try {
        onConnection(socket);
        socket.events.get('joinRoom')({ username: 'PrivateMember', room: privateRoom.id, password: privateRoom.password });
        socket.events.get('chatMessage')({ text: 'private room activity' });

        assert.equal(globalEvents.some(([event, payload]) => event === 'room-message' && payload.room === privateRoom.id), false);
        assert.ok(roomEvents.some(([room, event, payload]) => room === privateRoom.id && event === 'room-message' && payload.room === privateRoom.id));
    } finally {
        users.userLeave(socket.id);
        messages.getRoomMessages(privateRoom.id).forEach(message => messages.deleteMessage(message.id));
        roomManager.removeRoom(privateRoom.id);
    }
});

test('deleting a pinned message clears the pin and its expiry exemption', () => {
    const room = 'pin-delete-review-room';
    const message = messages.formatMessage('Alias', 'pinned text', room);
    messages.storeMessage(message);
    roomManager.setPinnedMessage({ id: message.id, text: message.text, username: message.username }, message);

    messages.deleteMessage(message.id);

    assert.equal(message.pinned, false);
    assert.equal(roomManager.getPinnedMessage(), null);
});
