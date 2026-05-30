const { v4: generateToken } = require('uuid');

// Store admin sessions: Map<token, { username, createdAt }>
const adminSessions = new Map();
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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

function verifySession(token) {
    if (!token || !adminSessions.has(token)) return null;
    const session = adminSessions.get(token);
    if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
        adminSessions.delete(token);
        return null;
    }
    return session;
}

function createSession(username) {
    const token = generateToken();
    adminSessions.set(token, { username, createdAt: Date.now() });
    return token;
}

// Express middleware: verify admin token from Authorization header
const isAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    const session = verifySession(token);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.adminUsername = session.username;
    next();
};

module.exports = {
    getAdminAccounts,
    verifySession,
    createSession,
    isAdmin
};
