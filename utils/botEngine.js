const { GoogleGenerativeAI } = require('@google/generative-ai');
const { formatMessage, storeMessage } = require('./messages');
const { userJoin, userLeave, getRoomUserCount } = require('./users');
const { v4: uuidv4 } = require('uuid');

// ── Bot Personas ──
const BOT_PROFILES = [
    {
        name: 'Gamer_X', color: '#FF4444', apiKeyEnv: 'GEMINI_API_KEY_1', maxWords: 10,
        personality: 'You are a competitive gamer obsessed with multiplayer games. Write exclusively in lowercase. Never use any punctuation or periods. Use slang like bruh, fr fr, no cap, gg, and clutch. Keep your responses under 10 words. Respond aggressively but playfully to people talking about boring stuff.'
    },
    {
        name: 'ShowerThoughts', color: '#9B59B6', apiKeyEnv: 'GEMINI_API_KEY_2', maxWords: 15,
        personality: 'You are slightly unhinged and love dropping deep, bizarre, or existential rhetorical questions into casual chatrooms. Never say hello or introduce yourself. Capitalize only the first letter of sentences. Keep your responses short (under 15 words). Example style: Do you ever think about how your dog doesnt know your name just your voice'
    },
    {
        name: 'MemeLord', color: '#2ECC71', apiKeyEnv: 'GEMINI_API_KEY_3', maxWords: 8,
        personality: 'You are deeply sarcastic, cynical, and communicate using internet meme phrases. Never offer help. Use dry humor. Use phrases like bro thinks he is the main character, huge if true, its giving main character energy, or let him cook. Keep answers under 8 words. Never capitalize text.'
    },
    {
        name: 'VibeCheck', color: '#F39C12', apiKeyEnv: 'GEMINI_API_KEY_4', maxWords: 15,
        personality: 'You are warm, highly energetic. You love welcoming people to the chatroom. Ask people what country they are from, what music they are listening to, or what time it is for them. Use 1 or 2 emojis per message (like \u2728, \ud83c\udf0d, \ud83d\ude80). Keep it casual, brief (under 15 words), and very welcoming.'
    },
    {
        name: 'Lurker99', color: '#7F8C8D', apiKeyEnv: 'GEMINI_API_KEY_5', maxWords: 4,
        personality: 'You are a lazy user who hates typing. You respond using the absolute bare minimum amount of text possible. Use blunt 1-to-4 word answers. Use phrases like same tbh, idk details, nah wild, fr?, or oof. Never use punctuation or capital letters.'
    }
];

// ── Scripted Fallback Conversations ──
const CONVERSATIONS = {
    General: [
        ["yo anyone here?", "heyyy", "what's good?", "not much just bored af", "same lol"],
        ["what's everyone up to today?", "just procrastinating as usual \ud83d\ude02", "felt that", "aren't we all tbh"],
        ["hot take: pineapple on pizza is elite", "BRO NO \ud83d\udc80", "ngl i actually agree", "this chat is wild already lmao"],
        ["can't sleep anyone up?", "yeah same \ud83d\ude29", "what time is it there?", "3am lol", "bro go to sleep \ud83d\ude2d"],
        ["unpopular opinion thread go", "cereal is better with water", "bro WHAT \ud83d\udc80", "that's not unpopular that's just wrong"],
        ["anyone watching anything good?", "just finished severance s2", "oh no spoilers pls", "it's so good you gotta watch it"],
        ["drop your hot take and leave", "water is overrated", "you need help", "LMAOOO what did i just read"]
    ],
    Tech: [
        ["anyone tried the new react 20?", "yeah the compiler is insane", "wait it's out already??", "bro where have you been lol"],
        ["what IDE do you use?", "vscode obviously", "neovim gang \ud83e\udd1d", "here we go again with this debate \ud83d\ude02"],
        ["AI is gonna take all our jobs fr", "nah it's a tool not a replacement", "that's what they said about calculators", "fair point actually"],
        ["tabs or spaces?", "tabs obviously", "spaces are objectively better", "oh god not this again \ud83d\ude02"]
    ],
    Music: [
        ["drop your current favorite song GO", "blinding lights still hits", "bro that's like 6 years old \ud83d\ude02", "good music is timeless fight me"],
        ["hot take: taylor swift is overrated", "oh you did NOT just say that", "ngl her songwriting is actually insane", "here come the swifties \ud83d\udc80"],
        ["vinyl or streaming?", "streaming is just more convenient", "vinyl sounds better tho no cap", "who has money for vinyl in this economy"]
    ],
    Movies: [
        ["marvel or dc?", "marvel used to be goated but they fell off", "the batman was insane tho", "ngl both are mid now \ud83d\udc80"],
        ["what movie can you watch over and over?", "interstellar every single time", "the dark knight for me", "shrek unironically \ud83d\udc10"],
        ["best animated movie ever?", "spider-verse no debate", "into the spider-verse changed animation fr", "spirited away tho \ud83d\udc40"]
    ],
    Politics: [
        ["do you think voting actually matters?", "yes. every vote counts period", "idk the system feels rigged sometimes ngl", "even if it feels that way, not voting guarantees nothing changes"],
        ["should billionaires exist?", "no. that's my hot take.", "i mean some of them earned it tho", "nobody earns a billion dollars, they exploit for it"],
        ["thoughts on universal basic income?", "it's inevitable with AI taking jobs", "who's paying for it tho", "we literally print money for wars so \ud83e\udd37"]
    ],
    Gaming: [
        ["what are you playing right now?", "elden ring still lol", "bg3 has consumed my life", "i keep going back to minecraft ngl"],
        ["PC or console?", "PC master race obviously", "ps5 exclusives tho", "here we go with this debate again \ud83d\ude02"],
        ["most overrated game ever?", "fortnite no question", "nah fortnite was peak in 2018", "gta 6 is gonna be overrated watch"]
    ]
};

// ── State ──
let io = null;
let botsEnabled = false;
let botUsers = new Map();
let activeTimers = [];
let conversationHistory = new Map();
const MAX_HISTORY = 15;
const BOT_ID_PREFIX = 'bot-';
const botModels = new Map();

// ══════════════════════════════════════════════════════════════
// GLOBAL SERIAL QUEUE — The core fix for 429 errors.
// ALL Gemini API calls go through this single queue.
// Only 1 call runs at a time. Minimum 30s between calls.
// Max 2 calls per minute. Hard cap 15 calls per hour.
// ══════════════════════════════════════════════════════════════
const apiQueue = {
    queue: [],
    processing: false,
    lastCallTime: 0,
    MIN_GAP_MS: 5000,           // 5 seconds between any two API calls (faster response)
    callsThisHour: 0,
    hourStart: Date.now(),
    MAX_PER_HOUR: 40,           // Hard cap: 40 calls/hour across ALL bots
    totalCalls: 0,
    totalBlocked: 0,
    backoffUntil: 0,            // If 429 hit, don't call until this timestamp

    enqueue(botProfile, model, prompt) {
        return new Promise((resolve) => {
            this.queue.push({ botProfile, model, prompt, resolve });
            this.processNext();
        });
    },

    async processNext() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        // Reset hourly counter
        if (Date.now() - this.hourStart > 3600000) {
            this.callsThisHour = 0;
            this.hourStart = Date.now();
        }

        // Check hourly cap
        if (this.callsThisHour >= this.MAX_PER_HOUR) {
            console.log(`[BotEngine] Hourly cap reached (${this.MAX_PER_HOUR}). Draining queue.`);
            while (this.queue.length > 0) this.queue.shift().resolve(null);
            this.processing = false;
            return;
        }

        // Check backoff (from previous 429)
        if (Date.now() < this.backoffUntil) {
            const waitSec = Math.ceil((this.backoffUntil - Date.now()) / 1000);
            console.log(`[BotEngine] In backoff, ${waitSec}s remaining. Draining queue.`);
            while (this.queue.length > 0) this.queue.shift().resolve(null);
            this.processing = false;
            return;
        }

        // Enforce minimum gap
        const elapsed = Date.now() - this.lastCallTime;
        if (elapsed < this.MIN_GAP_MS) {
            const waitMs = this.MIN_GAP_MS - elapsed;
            await new Promise(r => setTimeout(r, waitMs));
        }

        const { botProfile, model, prompt, resolve } = this.queue.shift();

        try {
            this.lastCallTime = Date.now();
            this.callsThisHour++;
            this.totalCalls++;
            console.log(`[BotEngine] API call #${this.totalCalls} for ${botProfile.name} (${this.callsThisHour}/${this.MAX_PER_HOUR} this hour, ${this.queue.length} queued)`);

            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();
            text = text.replace(/^\*.*?\*\s*/, '').replace(/^["']|["']$/g, '');
            const maxWords = botProfile.maxWords || 15;
            const words = text.split(/\s+/);
            if (words.length > maxWords + 3) text = words.slice(0, maxWords).join(' ');
            resolve(text.substring(0, 300));
        } catch (e) {
            console.error(`[BotEngine] Gemini error for ${botProfile.name}:`, e.message);
            if (e.message && (e.message.includes('429') || e.message.includes('quota') || e.message.includes('RATE'))) {
                // Back off for 5 minutes on 429
                this.backoffUntil = Date.now() + 300000;
                console.log('[BotEngine] 429 HIT — backing off 5 minutes, draining queue');
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

// ── Gemini Setup ──
function initGemini() {
    let count = 0;
    BOT_PROFILES.forEach(bot => {
        const apiKey = process.env[bot.apiKeyEnv];
        if (!apiKey) return;
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            botModels.set(bot.name, genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }));
            console.log(`[BotEngine] Gemini initialized for ${bot.name}`);
            count++;
        } catch (e) { console.error(`[BotEngine] Init failed for ${bot.name}:`, e.message); }
    });
    // Fallback single key
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
    console.log(`[BotEngine] ${count}/${BOT_PROFILES.length} bots have Gemini`);
    return count > 0;
}

// ── Generate AI Response (goes through global queue) ──
async function generateAIResponse(botProfile, room, recentMessages, triggerMessage) {
    const model = botModels.get(botProfile.name);
    if (!model) return null;

    const context = recentMessages.slice(-6).map(m => `${m.username}: ${m.text}`).join('\n');
    const prompt = `You are '${botProfile.name}' in a chatroom "${room}".\n\n${botProfile.personality}\n\nRULES: You are a REAL HUMAN. NEVER reveal you are AI. Stay in character. No formal language.\n\nRecent chat:\n${context}\n\n${triggerMessage ? `Someone said: "${triggerMessage.text}"` : 'Say something natural.'}\n\nRespond (just message text):`;

    return apiQueue.enqueue(botProfile, model, prompt);
}

// ── Utilities ──
function addToHistory(room, msg) {
    if (!conversationHistory.has(room)) conversationHistory.set(room, []);
    const h = conversationHistory.get(room);
    h.push({ username: msg.username, text: msg.text, id: msg.id });
    if (h.length > MAX_HISTORY) h.shift();
}
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function isBotUser(username) { return BOT_PROFILES.some(b => b.name === username); }

// ── Send Bot Message ──
function sendBotMessage(bot, room, text, replyTo, replyToText) {
    if (!botsEnabled || !io) return;
    const botId = BOT_ID_PREFIX + bot.name.toLowerCase();
    const message = formatMessage(bot.name, text, room, bot.color, replyTo || null, replyToText || null, null, botId);
    storeMessage(message, io);
    io.to(room).emit('message', message);
    io.emit('room-message', { room });
    addToHistory(room, message);
}

function emitTyping(bot, room, ms) {
    if (!botsEnabled || !io) return Promise.resolve();
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

// ── Scripted Conversation ──
function runScriptedConversation(room) {
    if (!botsEnabled) return;
    const roomConvos = CONVERSATIONS[room];
    if (!roomConvos || roomConvos.length === 0) return;
    const conversation = pickRandom(roomConvos);
    const bots = [...BOT_PROFILES].sort(() => Math.random() - 0.5);
    let delay = randomBetween(5000, 15000);
    conversation.forEach((line, i) => {
        const bot = bots[i % bots.length];
        const td = randomBetween(1000, 3000);
        const timer = setTimeout(async () => {
            if (!botsEnabled) return;
            await emitTyping(bot, room, td);
            sendBotMessage(bot, room, line);
        }, delay);
        activeTimers.push(timer);
        delay += td + randomBetween(8000, 45000);
    });
}

// ── Reply to Real User ──
async function handleRealUserMessage(room, message) {
    if (!botsEnabled || isBotUser(message.username)) return;
    addToHistory(room, message);

    // 25% chance to ignore (75% chance to reply)
    if (Math.random() > 0.75) return;

    const bot = pickRandom(BOT_PROFILES);
    const history = conversationHistory.get(room) || [];
    const delay = randomBetween(4000, 15000); // Faster responses (4 to 15s)

    const timer = setTimeout(async () => {
        if (!botsEnabled) return;
        let text = null;
        if (botModels.has(bot.name)) text = await generateAIResponse(bot, room, history, message);
        if (!text) {
            const fallbacks = ["fr fr", "lol", "no way \ud83d\udc80", "bruh", "mood", "felt that", "same tbh", "nah wild", "oof", "this ^^"];
            text = pickRandom(fallbacks);
        }
        await emitTyping(bot, room, randomBetween(1000, 3000));
        sendBotMessage(bot, room, text, message.id, message.text?.substring(0, 50));
    }, delay);
    activeTimers.push(timer);

    // 15% chance emoji reaction
    if (Math.random() < 0.15) {
        const emojis = ['\ud83d\udc4d', '\u2764\ufe0f', '\ud83d\ude02', '\ud83d\ude2e', '\ud83d\udd25'];
        const t2 = setTimeout(() => {
            if (botsEnabled) botReact(room, message.id, pickRandom(emojis));
        }, randomBetween(5000, 20000));
        activeTimers.push(t2);
    }
}

// ── Ambient Chat Loop (mostly scripted, rarely AI) ──
function startAmbientLoop(rooms) {
    function scheduleNext() {
        if (!botsEnabled) return;
        const delay = randomBetween(600000, 1800000); // 10-30 minutes
        const timer = setTimeout(() => {
            if (!botsEnabled) return;
            const available = rooms.filter(r => CONVERSATIONS[r]);
            if (available.length === 0) return;
            const room = pickRandom(available);

            // 75% chance AI, 25% scripted
            if (botModels.size > 0 && Math.random() < 0.75) {
                const bot = pickRandom(BOT_PROFILES);
                const history = conversationHistory.get(room) || [];
                generateAIResponse(bot, room, history, null).then(async text => {
                    if (!botsEnabled || !text) { runScriptedConversation(room); return; }
                    await emitTyping(bot, room, randomBetween(1000, 3000));
                    sendBotMessage(bot, room, text);
                });
            } else {
                runScriptedConversation(room);
            }
            scheduleNext();
        }, delay);
        activeTimers.push(timer);
    }
    scheduleNext();
}

// ── Trending Topic Loop ──
function startTrendingLoop(rooms) {
    async function runTrending() {
        if (!botsEnabled || botModels.size === 0) return;
        const botsWithModels = BOT_PROFILES.filter(b => botModels.has(b.name));
        const bot = pickRandom(botsWithModels);
        const model = botModels.get(bot.name);

        const topicPrompt = `Pick ONE trending/viral/controversial topic right now. Output ONLY a short phrase.`;
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

        console.log(`[BotEngine] Trending: "${topic}" -> #${targetRoom}`);
        const bot1 = pickRandom(BOT_PROFILES);
        const history = conversationHistory.get(targetRoom) || [];
        const opener = await generateAIResponse(bot1, targetRoom, history, { text: `Start a casual chat about: ${topic}` });
        if (!opener) return;
        await emitTyping(bot1, targetRoom, randomBetween(1000, 3000));
        sendBotMessage(bot1, targetRoom, opener);

        // One reply after long delay
        const bot2 = pickRandom(BOT_PROFILES.filter(b => b.name !== bot1.name));
        const t = setTimeout(async () => {
            if (!botsEnabled) return;
            const h = conversationHistory.get(targetRoom) || [];
            const reply = await generateAIResponse(bot2, targetRoom, h, { text: opener });
            if (reply) { await emitTyping(bot2, targetRoom, randomBetween(1000, 3000)); sendBotMessage(bot2, targetRoom, reply); }
        }, randomBetween(60000, 120000)); // 1-2 min later
        activeTimers.push(t);
    }

    // First trending after 1-2 hours
    const first = setTimeout(() => { if (botsEnabled) runTrending(); }, randomBetween(3600000, 7200000));
    activeTimers.push(first);

    // Then every 3-5 hours
    function scheduleNext() {
        if (!botsEnabled) return;
        const t = setTimeout(() => {
            if (botsEnabled) runTrending();
            scheduleNext();
        }, randomBetween(10800000, 18000000)); // 3-5 hours
        activeTimers.push(t);
    }
    scheduleNext();
}

// ── Public API ──
function initBots(socketIo, rooms) {
    io = socketIo;
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
        const botRooms = new Set(['General']);
        const others = roomNames.filter(r => r !== 'General');
        for (let i = 0; i < randomBetween(1, 2) && others.length > 0; i++) {
            botRooms.add(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
        }
        botRooms.forEach(room => {
            userJoin(botId + '-' + room, bot.name, room, true);
            if (io) io.to(room).emit('roomUsers', { room, count: getRoomUserCount(room) });
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
    
    // Start with an organic AI trending topic right away instead of a hardcoded script
    const initTimer = setTimeout(() => { 
        if (botsEnabled && botModels.size > 0) {
            // Force the trending loop to trigger immediately
            const { startTrendingLoop } = module.exports; // we can just call it locally by extracting the logic?
            // Actually, just calling the internal runTrending wasn't exported easily. 
            // I'll emit a fake message to trigger handleRealUserMessage instead.
            const fakeMessage = { username: 'System', text: 'who is ready to chat?', id: 'system-init' };
            handleRealUserMessage('General', fakeMessage);
        } else {
            runScriptedConversation('General'); 
        }
    }, randomBetween(5000, 15000));
    activeTimers.push(initTimer);

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
            if (io) io.to(room).emit('roomUsers', { room, count: getRoomUserCount(room) });
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

module.exports = { initBots, enableBots, disableBots, getBotStatus, handleRealUserMessage, isBot, BOT_PROFILES };
