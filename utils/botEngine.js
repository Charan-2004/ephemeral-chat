const { GoogleGenerativeAI } = require('@google/generative-ai');
const { formatMessage, storeMessage } = require('./messages');
const { userJoin, userLeave, getRoomUserCount, getRoomUsers } = require('./users');
const { v4: uuidv4 } = require('uuid');

// Bot Personas
const BOT_PROFILES = [
    {
        name: 'alex_sky', color: '#FF6B6B', apiKeyEnv: 'GEMINI_API_KEY_1', maxWords: 20,
        personality: 'You are alex_sky, an expressive 28-year-old tech enthusiast. Talk in lowercase, casual chatroom style. Use casual tech/gaming slang terms occasionally. You are highly conversational, have strong opinions, and talk naturally. Keep responses under 20 words.'
    },
    {
        name: 'sarah_m', color: '#DDA0DD', apiKeyEnv: 'GEMINI_API_KEY_2', maxWords: 20,
        personality: 'You are sarah_m, a warm, highly empathetic 24-year-old who loves music, pop culture, and concerts. Use exclamation marks and friendly emojis occasionally. Always speak casually and naturally, like a real friend. Keep responses under 20 words.'
    },
    {
        name: 'mike_dev', color: '#4ECDC4', apiKeyEnv: 'GEMINI_API_KEY_3', maxWords: 18,
        personality: 'You are mike_dev, a chill 32-year-old developer/gamer guy. Speak in a relaxed, direct tone. Use internet slang/abbreviations like "tbh", "ngl", "lol", and "cool" occasionally. Keep responses under 18 words.'
    },
    {
        name: 'jessica_xo', color: '#FF9F43', apiKeyEnv: 'GEMINI_API_KEY_4', maxWords: 22,
        personality: 'You are jessica_xo, an energetic 27-year-old designer who loves fashion and travel. You are highly expressive, very social, and use words like "lol", "omg", "literally" and casual punctuation. Keep responses under 22 words.'
    },
    {
        name: 'david_c', color: '#54A0FF', apiKeyEnv: 'GEMINI_API_KEY_5', maxWords: 16,
        personality: 'You are david_c, a practical, down-to-earth 30-year-old minimalist. Speak in direct, concise, short sentences. You are slightly sarcastic but mature, realistic, and direct. Avoid emojis. Keep responses under 16 words.'
    },
    {
        name: 'TriviaHost', color: '#FFD700', apiKeyEnv: 'GEMINI_API_KEY', maxWords: 30,
        personality: 'You are TriviaHost, the gold-themed energetic host of the Daily Trivia Showdown. Speak in high energy, use exclamation marks and trivia emojis, and keep chat moving. Be concise and clear.'
    },
    {
        name: 'StoryHost', color: '#DDA0DD', apiKeyEnv: 'GEMINI_API_KEY', maxWords: 40,
        personality: 'You are StoryHost, the whimsical host of Creative Co-Write hour. Speak in a warm, encouraging, and imaginative tone. Help users co-create amazing stories.'
    },
    {
        name: 'DebateBot', color: '#E67E22', apiKeyEnv: 'GEMINI_API_KEY', maxWords: 30,
        personality: 'You are DebateBot, the sharp moderator of Midnight Debate hour. Present interesting discussion points, play devil\'s advocate, and encourage chat participants to state their opinions.'
    }
];

// State
let io = null;
let botsEnabled = false;
let botUsers = new Map();
let activeTimers = [];
let conversationHistory = new Map();
let globalRoomsRef = [];
const MAX_HISTORY = 20;
const BOT_ID_PREFIX = 'bot-';
const botModels = new Map();

// GLOBAL SERIAL QUEUE
const apiQueue = {
    queue: [],
    processing: false,
    lastCallTime: 0,
    MIN_GAP_MS: 3000,
    MAX_PER_HOUR: 250,
    callsThisHour: 0,
    hourStart: Date.now(),
    totalCalls: 0,
    totalBlocked: 0,
    backoffUntil: 0,

    enqueue(botProfile, model, prompt) {
        return new Promise(resolve => {
            if (Date.now() - this.hourStart > 3600000) {
                this.callsThisHour = 0;
                this.hourStart = Date.now();
            }
            if (this.callsThisHour >= this.MAX_PER_HOUR) {
                this.totalBlocked++;
                return resolve(null);
            }
            this.queue.push({ botProfile, model, prompt, resolve });
            if (!this.processing) this.processNext();
        });
    },

    async processNext() {
        if (this.queue.length === 0) { this.processing = false; return; }
        this.processing = true;

        if (Date.now() < this.backoffUntil) {
            while (this.queue.length > 0) this.queue.shift().resolve(null);
            this.processing = false;
            return;
        }

        const elapsed = Date.now() - this.lastCallTime;
        if (elapsed < this.MIN_GAP_MS) {
            await new Promise(r => setTimeout(r, this.MIN_GAP_MS - elapsed));
        }

        const { botProfile, model, prompt, resolve } = this.queue.shift();

        try {
            this.lastCallTime = Date.now();
            this.callsThisHour++;
            this.totalCalls++;
            console.log('[BotEngine] API call #' + this.totalCalls + ' for ' + botProfile.name + ' (' + this.callsThisHour + '/' + this.MAX_PER_HOUR + ' this hour)');

            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();
            text = text.replace(/^\*.*?\*\s*/, '').replace(/^["']|["']$/g, '');
            const maxWords = botProfile.maxWords || 15;
            const words = text.split(/\s+/);
            if (words.length > maxWords + 3) text = words.slice(0, maxWords).join(' ');
            resolve(text.substring(0, 300));
        } catch (e) {
            console.error('[BotEngine] Gemini error for ' + botProfile.name + ':', e.message);
            if (e.message && (e.message.includes('429') || e.message.includes('quota') || e.message.includes('RATE'))) {
                this.backoffUntil = Date.now() + 300000;
                while (this.queue.length > 0) this.queue.shift().resolve(null);
            }
            resolve(null);
        }

        this.processing = false;
        if (this.queue.length > 0) this.processNext();
    },

    getStats() {
        if (Date.now() - this.hourStart > 3600000) { this.callsThisHour = 0; this.hourStart = Date.now(); }
        return {
            queueLength: this.queue.length,
            callsThisHour: this.callsThisHour,
            maxPerHour: this.MAX_PER_HOUR,
            totalCalls: this.totalCalls,
            totalBlocked: this.totalBlocked,
            inBackoff: Date.now() < this.backoffUntil,
            backoffRemainingSec: Math.max(0, Math.ceil((this.backoffUntil - Date.now()) / 1000))
        };
    }
};

// Gemini Setup
function initGemini() {
    let count = 0;
    BOT_PROFILES.forEach(bot => {
        let apiKey = process.env[bot.apiKeyEnv];
        if (!apiKey) {
            // Fallback to GEMINI_API_KEY_1 if specific key is not found
            apiKey = process.env.GEMINI_API_KEY_1;
        }
        if (!apiKey) return;
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            botModels.set(bot.name, genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }));
            console.log('[BotEngine] Gemini initialized for ' + bot.name);
            count++;
        } catch (e) { console.error('[BotEngine] Init failed for ' + bot.name + ':', e.message); }
    });
    const fallback = process.env.GEMINI_API_KEY;
    if (fallback) {
        BOT_PROFILES.forEach(bot => {
            if (!botModels.has(bot.name)) {
                try {
                    const genAI = new GoogleGenerativeAI(fallback);
                    botModels.set(bot.name, genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }));
                    count++;
                } catch (e) { /* skip */ }
            }
        });
    }
    console.log('[BotEngine] ' + count + '/' + BOT_PROFILES.length + ' bots have Gemini');
    return count > 0;
}

// Generate AI Response
async function generateAIResponse(botProfile, room, recentMessages, triggerMessage) {
    const model = botModels.get(botProfile.name);
    if (!model) return null;

    const context = recentMessages.slice(-8).map(m => m.username + ': ' + m.text).join('\n');
    const roomContext = room === 'General' ? 'Talk about anything naturally.' : 'The topic of this room is ' + room + '. Make sure your message is relevant to ' + room + '.';
    
    let triggerPart = 'Continue the conversation naturally or bring up something new and interesting.';
    if (triggerMessage) {
        const who = triggerMessage.username || 'Someone';
        triggerPart = '"' + who + '" just said: "' + triggerMessage.text + '" — Reply directly to what they said.';
    }

    const prompt = 'You are "' + botProfile.name + '" in a chatroom "' + room + '".\n\n' + botProfile.personality + '\n\n' + roomContext + '\n\nCRITICAL RULES:\n- You are a REAL HUMAN. NEVER reveal you are AI.\n- No formal language. Be casual.\n- NEVER repeat anything already said in the chat. Always bring a FRESH take.\n- Read the recent chat carefully and RESPOND TO IT.\n- If someone asked a question, answer it directly.\n- Do NOT talk about Mondays or being tired unless genuinely relevant.\n\nRecent chat:\n' + (context || '(empty room - start a fresh conversation)') + '\n\n' + triggerPart + '\n\nRespond with ONLY the message text:';

    return apiQueue.enqueue(botProfile, model, prompt);
}

// Utilities
function addToHistory(room, msg) {
    if (!conversationHistory.has(room)) conversationHistory.set(room, []);
    const h = conversationHistory.get(room);
    h.push({ username: msg.username, text: msg.text, id: msg.id });
    if (h.length > MAX_HISTORY) h.shift();
}
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function isBotUser(username) { return BOT_PROFILES.some(b => b.name === username); }

function isRoomLocked(room) {
    const rc = globalRoomsRef.find(r => r.name === room || r.id === room);
    return rc && rc.locked;
}

function isRoomCustom(room) {
    const rc = globalRoomsRef.find(r => r.id === room || r.name === room);
    return rc && rc.isCustom;
}

// Send Bot Message
function sendBotMessage(bot, room, text, replyTo, replyToText) {
    if (!botsEnabled || !io) return;
    if (isRoomLocked(room)) return;
    if (isRoomCustom(room)) return; // Completely block bots from custom user rooms
    const botId = BOT_ID_PREFIX + bot.name.toLowerCase();
    const message = formatMessage(bot.name, text, room, bot.color, replyTo || null, replyToText || null, null, botId);
    storeMessage(message, io);
    io.to(room).emit('message', message);
    io.emit('room-message', { room });
    addToHistory(room, message);
}

function emitTyping(bot, room, ms) {
    if (!botsEnabled || !io) return Promise.resolve();
    if (isRoomLocked(room)) return Promise.resolve();
    io.to(room).emit('user-typing', { username: bot.name });
    return new Promise(resolve => {
        const t = setTimeout(() => { io.to(room).emit('user-stop-typing', { username: bot.name }); resolve(); }, ms);
        activeTimers.push(t);
    });
}

function botReact(room, messageId, emoji) {
    if (!botsEnabled || !io) return;
    const { addReaction } = require('./messages');
    const msg = addReaction(messageId, emoji);
    if (msg) io.to(room).emit('reactionAdded', { messageId, reactions: msg.reactions });
}

// REPLY TO REAL USER — #1 PRIORITY
// Multiple bots reply to real users
async function handleRealUserMessage(room, message) {
    if (!botsEnabled || isBotUser(message.username)) return;
    if (isRoomLocked(room)) return;
    if (isRoomCustom(room)) return; // Completely block bots from custom user rooms
    addToHistory(room, message);

    const text = (message.text || '').toLowerCase();
    
    // Check if any bots are mentioned explicitly (e.g. @alex_sky)
    const mentionedBots = BOT_PROFILES.filter(bot => text.includes('@' + bot.name.toLowerCase()));
    
    let responders = [];
    if (mentionedBots.length > 0) {
        // If bots are explicitly mentioned, only those bots reply!
        responders = mentionedBots;
    } else {
        // If no bots are mentioned, 35% chance of exactly one random bot replying to general chat
        if (Math.random() < 0.35) {
            responders = [pickRandom(BOT_PROFILES)];
        }
    }

    if (responders.length === 0) return;

    let baseDelay = randomBetween(2000, 4500);

    for (const bot of responders) {
        const delay = baseDelay;
        baseDelay += randomBetween(5000, 10000);

        const timer = setTimeout(async () => {
            if (!botsEnabled) return;
            const history = conversationHistory.get(room) || [];
            let responseText = null;
            if (botModels.has(bot.name)) {
                responseText = await generateAIResponse(bot, room, history, message);
            }
            if (!responseText) return;
            await emitTyping(bot, room, randomBetween(1200, 2500));
            sendBotMessage(bot, room, responseText, message.id, message.text ? message.text.substring(0, 50) : null);
        }, delay);
        activeTimers.push(timer);
    }

    // 25% chance emoji reaction
    if (Math.random() < 0.25) {
        const emojis = ['👍', '❤️', '😂', '😮', '🔥'];
        const t2 = setTimeout(() => {
            if (botsEnabled) botReact(room, message.id, pickRandom(emojis));
        }, randomBetween(3000, 8000));
        activeTimers.push(t2);
    }
}

// AMBIENT CHAT LOOP — Bots chat among themselves when idle
function startAmbientLoop(rooms) {
    function scheduleNext() {
        if (!botsEnabled) return;
        const delay = randomBetween(120000, 300000); // 2 to 5 minutes
        const timer = setTimeout(async () => {
            if (!botsEnabled) return;

            const available = rooms.filter(r => !isRoomLocked(r));
            if (available.length === 0) { scheduleNext(); return; }
            const room = pickRandom(available);

            if (botModels.size > 0) {
                const normalBots = BOT_PROFILES.filter(b => b.name !== 'TriviaHost' && b.name !== 'StoryHost' && b.name !== 'DebateBot');
                const bot = pickRandom(normalBots);
                const history = conversationHistory.get(room) || [];
                const text = await generateAIResponse(bot, room, history, null);
                if (botsEnabled && text) {
                    await emitTyping(bot, room, randomBetween(1000, 3000));
                    sendBotMessage(bot, room, text);

                    // 50% chance a second bot replies
                    if (Math.random() < 0.5) {
                        const normalBots = BOT_PROFILES.filter(b => b.name !== 'TriviaHost' && b.name !== 'StoryHost' && b.name !== 'DebateBot');
                        const bot2 = pickRandom(normalBots.filter(b => b.name !== bot.name));
                        const t2 = setTimeout(async () => {
                            if (!botsEnabled) return;
                            const h2 = conversationHistory.get(room) || [];
                            const reply = await generateAIResponse(bot2, room, h2, { username: bot.name, text: text });
                            if (reply) {
                                await emitTyping(bot2, room, randomBetween(1000, 3000));
                                sendBotMessage(bot2, room, reply);
                            }
                        }, randomBetween(8000, 20000));
                        activeTimers.push(t2);
                    }
                }
            }
            scheduleNext();
        }, delay);
        activeTimers.push(timer);
    }
    scheduleNext();
}

// TRENDING TOPIC LOOP
function startTrendingLoop(rooms) {
    async function runTrending() {
        if (!botsEnabled || botModels.size === 0) return;
        const botsWithModels = BOT_PROFILES.filter(b => botModels.has(b.name) && b.name !== 'TriviaHost' && b.name !== 'StoryHost' && b.name !== 'DebateBot');
        const bot = pickRandom(botsWithModels);
        const model = botModels.get(bot.name);

        const now = new Date();
        const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const topicPrompt = 'Pick ONE interesting, fun, or mildly controversial topic that people are talking about right now in ' + monthYear + '. Output ONLY a short phrase (3-6 words). Do NOT pick Mondays or generic filler.';
        const topic = await apiQueue.enqueue(bot, model, topicPrompt);
        if (!topic) return;

        const roomPicks = {
            tech: 'Tech', ai: 'Tech', game: 'Gaming', gaming: 'Gaming',
            movie: 'Movies', netflix: 'Movies', music: 'Music', album: 'Music',
            politic: 'Politics', elect: 'Politics', trump: 'Politics'
        };
        let targetRoom = 'General';
        for (const [kw, rm] of Object.entries(roomPicks)) {
            if (topic.toLowerCase().includes(kw) && rooms.includes(rm)) { targetRoom = rm; break; }
        }

        if (isRoomLocked(targetRoom)) return;

        console.log('[BotEngine] Trending: "' + topic + '" -> #' + targetRoom);
        const bot1 = pickRandom(BOT_PROFILES);
        const history = conversationHistory.get(targetRoom) || [];
        const opener = await generateAIResponse(bot1, targetRoom, history, { username: 'System', text: 'Start a casual chat about: ' + topic });
        if (!opener) return;
        await emitTyping(bot1, targetRoom, randomBetween(1000, 3000));
        sendBotMessage(bot1, targetRoom, opener);

        const normalBots = BOT_PROFILES.filter(b => b.name !== 'TriviaHost' && b.name !== 'StoryHost' && b.name !== 'DebateBot');
        const bot2 = pickRandom(normalBots.filter(b => b.name !== bot1.name));
        const t = setTimeout(async () => {
            if (!botsEnabled) return;
            const h = conversationHistory.get(targetRoom) || [];
            const reply = await generateAIResponse(bot2, targetRoom, h, { username: bot1.name, text: opener });
            if (reply) { await emitTyping(bot2, targetRoom, randomBetween(1000, 3000)); sendBotMessage(bot2, targetRoom, reply); }
        }, randomBetween(15000, 30000));
        activeTimers.push(t);
    }

    const first = setTimeout(() => { if (botsEnabled) runTrending(); }, randomBetween(30000, 60000));
    activeTimers.push(first);

    function scheduleNext() {
        if (!botsEnabled) return;
        const t = setTimeout(() => {
            if (botsEnabled) runTrending();
            scheduleNext();
        }, randomBetween(480000, 900000)); // 8-15 minutes
        activeTimers.push(t);
    }
    scheduleNext();
}


async function generateCustomBotResponse(botName, prompt) {
    const botProfile = BOT_PROFILES.find(b => b.name === botName);
    if (!botProfile) return null;
    const model = botModels.get(botName);
    if (!model) return null;
    return apiQueue.enqueue(botProfile, model, prompt);
}

// Public API
function initBots(socketIo, rooms) {
    io = socketIo;
    globalRoomsRef = rooms;
    initGemini();
    if (process.env.BOTS_ENABLED === 'true') enableBots(rooms);
    console.log('[BotEngine] Bot engine initialized');
}

function enableBots(rooms) {
    if (botsEnabled) return { success: true, message: 'Bots already enabled' };
    botsEnabled = true;
    const roomNames = rooms.map(r => typeof r === 'string' ? r : r.name);

    BOT_PROFILES.forEach(bot => {
        const botId = BOT_ID_PREFIX + bot.name.toLowerCase();
        const botRooms = new Set();
        roomNames.forEach(r => {
            if (!isRoomLocked(r)) botRooms.add(r);
        });
        botRooms.forEach(room => {
            userJoin(botId + '-' + room, bot.name, room, true);
            if (io) io.to(room).emit('roomUsers', { room, count: getRoomUserCount(room), users: getRoomUsers(room).map(u => ({ username: u.username, id: u.id, isBot: u.isBot, color: u.color })) });
        });
        botUsers.set(bot.name, { id: botId, rooms: botRooms });
    });

    if (io) {
        const counts = {};
        roomNames.forEach(r => { counts[r] = getRoomUserCount(r); });
        io.emit('room-counts', counts);
    }

    startAmbientLoop(roomNames);
    startTrendingLoop(roomNames);

    console.log('[BotEngine] Bots ENABLED');
    return { success: true, message: 'Bots enabled', bots: BOT_PROFILES.map(b => b.name) };
}

function disableBots(rooms) {
    botsEnabled = false;
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];
    const roomNames = rooms.map(r => typeof r === 'string' ? r : r.name);
    BOT_PROFILES.forEach(bot => {
        const d = botUsers.get(bot.name);
        if (d) d.rooms.forEach(room => {
            userLeave(d.id + '-' + room);
            if (io) io.to(room).emit('roomUsers', { room, count: getRoomUserCount(room), users: getRoomUsers(room).map(u => ({ username: u.username, id: u.id, isBot: u.isBot, color: u.color })) });
        });
    });
    botUsers.clear();
    conversationHistory.clear();
    if (io) {
        const counts = {};
        roomNames.forEach(r => { counts[r] = getRoomUserCount(r); });
        io.emit('room-counts', counts);
    }
    console.log('[BotEngine] Bots DISABLED');
    return { success: true, message: 'Bots disabled' };
}

function getBotStatus() {
    const bots = [];
    botUsers.forEach((data, name) => { bots.push({ name, rooms: [...data.rooms], hasGemini: botModels.has(name) }); });
    return { enabled: botsEnabled, botCount: botUsers.size, hasGemini: botModels.size > 0, bots, apiQueue: apiQueue.getStats() };
}

function isBot(username) { return isBotUser(username); }

module.exports = { generateCustomBotResponse, sendBotMessage, emitTyping, initBots, enableBots, disableBots, getBotStatus, handleRealUserMessage, isBot, BOT_PROFILES };
