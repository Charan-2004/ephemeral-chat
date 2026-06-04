require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Custom Utilities & Modules
const { cleanExpiredMessages } = require('./utils/messages');
const { initBots } = require('./utils/botEngine');
const { getRooms, getPublicRooms, cleanupIdleCustomRooms, broadcastRoomCounts } = require('./utils/roomManager');
const { initLeaderboardScheduler } = require('./utils/leaderboard');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const registerSocketHandlers = require('./handlers/socketHandlers');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    maxHttpBufferSize: 3e6
});

// Store io reference on app for route access
app.set('io', io);

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
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

// Routes Setup
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Cleanup Loop (every 5 seconds)
setInterval(() => {
    cleanExpiredMessages(io);
}, 5000);

// Cleanup idle empty custom rooms (every 60 seconds)
setInterval(() => {
    try {
        const changed = cleanupIdleCustomRooms();
        if (changed && io) {
            io.emit('rooms-updated', getPublicRooms());
            broadcastRoomCounts(io);
        }
    } catch (err) {
        console.error('Custom room cleanup error:', err);
    }
}, 60000);

// Socket.io handlers orchestration
registerSocketHandlers(io);

// Server startup
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initBots(io, getRooms());
    initLeaderboardScheduler(io);
});
