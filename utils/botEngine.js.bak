const { GoogleGenerativeAI } = require('@google/generative-ai');
const { formatMessage, storeMessage } = require('./messages');
const { userJoin, userLeave, getRoomUserCount } = require('./users');
const { v4: uuidv4 } = require('uuid');

// ── Bot Personas ──
const BOT_PROFILES = [
    {
        name: 'Alex', color: '#FF4444', apiKeyEnv: 'GEMINI_API_KEY_1', maxWords: 25,
        personality: 'You are an ordinary 28-year-old American named Alex. You are expressive, have strong feelings, and do not hold back your opinions. You talk like a normal human being in a casual chatroom. Share regular daily life stuff, complain about work or traffic, or get deeply emotional about random topics. Keep your responses conversational and under 25 words.'
    },
    {
        name: 'Sarah', color: '#9B59B6', apiKeyEnv: 'GEMINI_API_KEY_2', maxWords: 25,
        personality: 'You are a 24-year-old American named Sarah. You are highly empathetic but also blunt when you need to be. You behave like a completely normal human being with real feelings and emotions. You love chatting about TV shows, life stress, or just seeing how people are doing. Use normal conversational English. Keep your responses under 25 words.'
    },
    {
        name: 'Mike', color: '#2ECC71', apiKeyEnv: 'GEMINI_API_KEY_3', maxWords: 20,
        personality: 'You are a 32-year-old American guy named Mike. You are a regular human being with unfiltered opinions. You don\'t hold back on what you think, whether you are talking about sports, news, or just random chatroom topics. You have real feelings and express them naturally. Keep your responses casual, realistic, and under 20 words.'
    },
    {
        name: 'Jessica', color: '#F39C12', apiKeyEnv: 'GEMINI_API_KEY_4', maxWords: 25,
        personality: 'You are a 27-year-old American named Jessica. You are very social, warm, but also have bad days like any normal human being. You express all your feelings openly and naturally. You don\'t hold back. You chat just like a real person hanging out online after a long day. Keep your responses under 25 words.'
    },
    {
        name: 'David', color: '#7F8C8D', apiKeyEnv: 'GEMINI_API_KEY_5', maxWords: 20,
        personality: 'You are a 30-year-old American named David. You are a completely normal human being. You are sometimes tired, sometimes excited, and you never hide your true feelings. You speak your mind without holding back. You use normal conversational English. Keep your responses realistic, organic, and under 20 words.'
    }
];

// ── Scripted Fallback Conversations ──
const CONVERSATIONS = {
    General: [
        ["Hey everyone, how's it going?", "Hey! Doing alright, just finishing up work.", "Good here! How about you?", "Just relaxing at home.", "Yeah, same here honestly."],
        ["What is everyone doing this weekend?", "Probably just catching up on chores.", "Going out to dinner with some friends.", "I need a long nap tbh."],
        ["I am so tired today.", "I feel you, it's been a long week.", "Get some coffee! It helps.", "Haha I am literally falling asleep too."],
        ["Anyone here?", "Yep, just reading through.", "I'm around. What's up?", "Hey there!"],
        ["It is way too hot outside today.", "Tell me about it. I am staying indoors.", "I actually love the warm weather.", "Make sure to stay hydrated!"],
        ["Anyone watching any good shows lately?", "Just started the new season of Severance.", "Oh nice, I need to check that out.", "I am looking for recommendations too!"],
        ["I can't wait for Friday.", "Same, this week dragged on forever.", "Agreed. I need a break.", "You guys always complain about work haha"]
    ],
    Tech: [
        ["Has anyone tried the new AI tools?", "Yeah, they are getting surprisingly good.", "I use them for coding daily now.", "I still prefer doing things manually sometimes."],
        ["What IDE are you guys using these days?", "VS Code all the way.", "I'm still a loyal IntelliJ user.", "Whatever gets the job done!"],
        ["The tech industry is changing so fast.", "It really is. Hard to keep up.", "You just have to keep learning.", "Yeah it's exciting but exhausting."]
    ],
    Music: [
        ["What is everyone listening to right now?", "I've had the new pop hits on repeat.", "Mostly just lo-fi beats while I work.", "I'm going through a classic rock phase."],
        ["Do you guys prefer playlists or full albums?", "Playlists for sure. Good mix.", "I like listening to an album front to back.", "Depends on my mood honestly."],
        ["Live concerts are getting so expensive.", "Yeah, ticket prices are insane now.", "I only go if it's my absolute favorite artist.", "I miss the cheap local shows."]
    ],
    Movies: [
        ["What's the best movie you've seen recently?", "I finally watched Interstellar again.", "Oh I love that one! Such a classic.", "I need to go to the theater more often."],
        ["Do you prefer theaters or watching at home?", "Home for sure. So much more comfortable.", "There's something special about the big screen though.", "Yeah but snacks at home are cheaper haha"],
        ["I wish they made more original movies.", "Everything is a sequel or reboot now.", "True, but some of the reboots are decent.", "I just want good storytelling."]
    ],
    Politics: [
        ["Did anyone see the news this morning?", "Yeah, it's a lot to process.", "I try to limit how much news I read honestly.", "It's important to stay informed though."],
        ["Local elections are coming up soon.", "Make sure you guys are registered.", "I feel like local politics matter more anyway.", "Yeah they definitely impact daily life more."],
        ["The economy has been so unpredictable.", "Everything is just getting more expensive.", "Yeah, inflation is hitting everyone hard.", "I'm just trying to budget better."]
    ],
    Gaming: [
        ["What is everyone playing this week?", "Still stuck on Elden Ring.", "I've been playing some indie games.", "Mostly just multiplayer with friends."],
        ["PC or Console?", "PC for the mods.", "Console is just easier. Plug and play.", "Both have their perks honestly."],
        ["Games take so long to develop now.", "Yeah, 5 to 6 years is the standard.", "I'd rather wait for a finished game than a rushed one.", "True, but the wait is brutal."]
    ]
};

// ── State ──
let io = null;
let botsEnabled = false;
let botUsers = new Map();
let activeTimers = [];
let conversationHistory = new Map();
let globalRoomsRef = []; // We will store the full rooms array here to check lock status
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
    MIN_GAP_MS: 3000,           // 3 seconds between API calls (20 RPM max)
    callsThisHour: 0,
    hourStart: Date.now(),
    MAX_PER_HOUR: 250,          // 5 keys = huge quota. Safe to raise to 250/hr.
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
    const roomContext = room === 'General' ? 'Talk about anything naturally.' : `The topic of this room is ${room}. Make sure your message is highly relevant to ${room}.`;
    const prompt = `You are '${botProfile.name}' in a chatroom "${room}".\n\n${botProfile.personality}\n\n${roomContext}\n\nRULES: You are a REAL HUMAN. NEVER reveal you are AI. Stay in character. No formal language.\n\nRecent chat:\n${context}\n\n${triggerMessage ? `Someone said: "${triggerMessage.text}"` : 'Say something natural.'}\n\nRespond (just message text):`;

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
    const roomConfig = globalRoomsRef.find(r => r.name === room);
    if (roomConfig && roomConfig.locked) return; // Prevent bots from posting in locked rooms
    
    const botId = BOT_ID_PREFIX + bot.name.toLowerCase();
    const message = formatMessage(bot.name, text, room, bot.color, replyTo || null, replyToText || null, null, botId);
    storeMessage(message, io);
    io.to(room).emit('message', message);
    io.emit('room-message', { room });
    addToHistory(room, message);
}

function emitTyping(bot, room, ms) {
    if (!botsEnabled || !io) return Promise.resolve();
    const roomConfig = globalRoomsRef.find(r => r.name === room);
    if (roomConfig && roomConfig.locked) return Promise.resolve();

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

    // 100% chance to reply to real users! Don't ignore them anymore.
    // (We removed the Math.random check)

    const bot = pickRandom(BOT_PROFILES);
    const history = conversationHistory.get(room) || [];
    const delay = randomBetween(2000, 8000); // Super fast responses (2 to 8s)

    const timer = setTimeout(async () => {
        if (!botsEnabled) return;
        let text = null;
        if (botModels.has(bot.name)) text = await generateAIResponse(bot, room, history, message);
        if (!text) return; // Just stop texting if there is an API error
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
        const delay = randomBetween(60000, 180000); // 1 to 3 minutes (very active)
        const timer = setTimeout(() => {
            if (!botsEnabled) return;
            // Only allow unlocked rooms for ambient chats
            const available = rooms.filter(r => {
                if (!CONVERSATIONS[r]) return false;
                const rc = globalRoomsRef.find(gr => gr.name === r);
                return !rc || !rc.locked;
            });
            if (available.length === 0) return;
            const room = pickRandom(available);

            // 100% AI, no scripted fallback conversations
            if (botModels.size > 0) {
                const bot = pickRandom(BOT_PROFILES);
                const history = conversationHistory.get(room) || [];
                generateAIResponse(bot, room, history, null).then(async text => {
                    if (!botsEnabled || !text) return; // Just stop texting if there is an API error
                    await emitTyping(bot, room, randomBetween(1000, 3000));
                    sendBotMessage(bot, room, text);
                });
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

        const roomConfig = globalRoomsRef.find(r => r.name === targetRoom);
        if (roomConfig && roomConfig.locked) return; // Prevent trending loops in locked rooms

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
        }, randomBetween(15000, 30000)); // 15-30s later
        activeTimers.push(t);
    }

    // First trending after 30 to 60 seconds of server boot!
    const first = setTimeout(() => { if (botsEnabled) runTrending(); }, randomBetween(30000, 60000));
    activeTimers.push(first);

    // Then every 5 to 10 minutes (highly active discussions)
    function scheduleNext() {
        if (!botsEnabled) return;
        const t = setTimeout(() => {
            if (botsEnabled) runTrending();
            scheduleNext();
        }, randomBetween(300000, 600000)); // 5-10 minutes
        activeTimers.push(t);
    }
    scheduleNext();
}

// ── Public API ──
function initBots(socketIo, rooms) {
    io = socketIo;
    globalRoomsRef = rooms; // Store the full room objects to track locked state
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
