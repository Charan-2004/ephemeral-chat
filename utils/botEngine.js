const { GoogleGenerativeAI } = require('@google/generative-ai');
const { formatMessage, storeMessage } = require('./messages');
const { userJoin, userLeave, getRoomUserCount } = require('./users');
const { v4: uuidv4 } = require('uuid');

// ── Bot Personas ──
const BOT_PROFILES = [
    { name: 'Alex', color: '#FF6B6B', personality: 'chill gen-z dude who uses slang, abbreviations, and is opinionated. loves tech and gaming. types in lowercase mostly.' },
    { name: 'Jordan', color: '#45B7D1', personality: 'curious and friendly person who asks follow-up questions. into music, movies, and pop culture. uses emojis occasionally.' },
    { name: 'Sam', color: '#96CEB4', personality: 'witty and sarcastic but in a fun way. has hot takes on everything. not afraid of controversial opinions. uses "lol" and "ngl" a lot.' },
    { name: 'Riley', color: '#DDA0DD', personality: 'chill night owl who vibes. into philosophy, deep convos, and random shower thoughts. types casually with typos sometimes.' },
    { name: 'Casey', color: '#FF9F43', personality: 'energetic and enthusiastic. reacts strongly to things. uses caps for emphasis sometimes. loves debating politics and current events.' }
];

// ── Scripted Fallback Conversations (per room) ──
const CONVERSATIONS = {
    General: [
        ["yo anyone here?", "heyyy", "what's good?", "not much just bored af", "same lol"],
        ["what's everyone up to today?", "just procrastinating as usual 😂", "felt that", "aren't we all tbh"],
        ["hot take: pineapple on pizza is elite", "BRO NO 💀", "ngl i actually agree", "this chat is wild already lmao"],
        ["can't sleep anyone up?", "yeah same 😩", "what time is it there?", "3am lol", "bro go to sleep 😭"],
        ["what's your comfort food?", "ramen hits different at 2am", "for me it's grilled cheese ngl", "valid choices both of you"],
        ["anyone else just doom scrolling?", "literally me rn", "i should be doing hw but here i am", "mood 💀"],
        ["okay but what's the best streaming service", "netflix fell off tbh", "hbo max clears", "disney+ is underrated ngl"],
        ["tell me something random about yourself", "i can solve a rubik's cube in under a minute", "wait that's actually cool", "i once ate 12 tacos in one sitting", "legend 🐐"],
        ["what song is stuck in your head rn?", "that new kendrick track won't leave my brain", "oh which one?", "the one from the album, you know the vibe"],
        ["unpopular opinion thread go", "cereal is better with water", "bro WHAT 💀", "that's not unpopular that's just wrong", "LMAOOO"],
        ["anyone watching anything good?", "just finished severance s2", "oh no spoilers pls", "it's so good you gotta watch it"],
        ["what's the best emoji", "💀 easily", "nah 😭 carries every conversation", "valid point actually"],
        ["how's everyone's mental health doing fr", "surviving not thriving", "felt that on a spiritual level", "we're all just vibing through it"],
        ["drop your hot take and leave", "water is overrated", "you need help", "LMAOOO what did i just read"],
        ["what do you guys do for work?", "software dev, classic", "barista by day gamer by night", "unemployed but thriving ✨"]
    ],
    Tech: [
        ["anyone tried the new react 20?", "yeah the compiler is insane", "wait it's out already??", "bro where have you been lol"],
        ["what IDE do you use?", "vscode obviously", "neovim gang 🤝", "here we go again with this debate 😂"],
        ["AI is gonna take all our jobs fr", "nah it's a tool not a replacement", "that's what they said about calculators", "fair point actually"],
        ["what programming language should i learn first?", "python no debate", "javascript if you want web stuff", "honestly just pick one and commit"],
        ["linux vs windows vs mac GO", "linux for dev, mac for everything else", "windows gaming tho", "wsl2 changed the game ngl"],
        ["just spent 4 hours debugging a semicolon", "classic 💀", "been there done that", "the pain is real with this one"],
        ["what's the most overrated tech trend?", "blockchain anything", "ngl metaverse was a scam", "web3 died so fast lmao"],
        ["tabs or spaces?", "tabs obviously", "spaces are objectively better", "oh god not this again 😂"],
        ["anyone building anything cool?", "making a chat app actually", "oh nice what stack?", "node and socket.io, it's fun"],
        ["rust is the future fight me", "it's good but the learning curve is insane", "ngl i'm still scared of the borrow checker", "skill issue 😤"]
    ],
    Music: [
        ["drop your current favorite song GO", "blinding lights still hits", "bro that's like 6 years old 😂", "good music is timeless fight me"],
        ["what genre do you guys listen to?", "hip hop mostly", "indie rock here", "i listen to literally everything ngl"],
        ["hot take: taylor swift is overrated", "oh you did NOT just say that", "ngl her songwriting is actually insane", "here come the swifties 💀"],
        ["anyone going to any concerts this year?", "trying to get kendrick tickets", "those sold out in like 2 seconds", "pain 😩"],
        ["what's your workout playlist vibe?", "heavy bass electronic stuff", "rage rap gets me going", "i just put on lo-fi and pretend i'm in an anime"],
        ["album of the year so far?", "easily that new tyler album", "nah sza clears", "both valid honestly"],
        ["what artist do you secretly love?", "nickelback and i'm not ashamed", "BRO 💀", "at least you're honest lmaooo"],
        ["vinyl or streaming?", "streaming is just more convenient", "vinyl sounds better tho no cap", "who has money for vinyl in this economy"]
    ],
    Movies: [
        ["what's the last movie that blew your mind?", "everything everywhere all at once", "that movie is a masterpiece fr", "the ending had me crying ngl"],
        ["marvel or dc?", "marvel used to be goated but they fell off", "the batman was insane tho", "ngl both are mid now 💀"],
        ["scariest movie you've ever seen?", "hereditary messed me up", "the conjuring had me sleeping with lights on", "i'm too scared to watch horror alone lol"],
        ["what movie can you watch over and over?", "interstellar every single time", "the dark knight for me", "shrek unironically 🐐"],
        ["hot take: movie theaters are dying", "nah the experience can't be replicated", "idk my couch is pretty comfortable", "the $20 popcorn is criminal tho"],
        ["best animated movie ever?", "spider-verse no debate", "into the spider-verse changed animation fr", "spirited away tho 👀"],
        ["worst movie you've ever seen?", "cats. just cats.", "the emoji movie exists", "at least cats was funny bad 😂"]
    ],
    Politics: [
        ["do you think voting actually matters?", "yes. every vote counts period", "idk the system feels rigged sometimes ngl", "even if it feels that way, not voting guarantees nothing changes"],
        ["what issue doesn't get enough attention?", "mental health funding is a joke", "housing crisis is insane rn", "both of these fr, nobody talks about it enough"],
        ["left vs right is such a false binary", "THANK YOU someone said it", "ngl the tribalism is exhausting", "people treat politics like sports teams"],
        ["should social media be regulated?", "yes 100% it's destroying kids", "but who decides what gets regulated tho", "that's the real question right there"],
        ["what's the biggest issue facing our generation?", "climate change easily", "cost of living is killing us", "student debt enters the chat 💀"],
        ["is democracy actually working?", "it's the worst system except for all the others lol", "that's literally a churchill quote 😂", "still true tho"],
        ["should billionaires exist?", "no. that's my hot take.", "i mean some of them earned it tho", "nobody earns a billion dollars, they exploit for it", "this is getting spicy 🌶️"],
        ["thoughts on universal basic income?", "it's inevitable with AI taking jobs", "who's paying for it tho", "we literally print money for wars so 🤷"]
    ],
    Gaming: [
        ["what are you playing right now?", "elden ring still lol", "bg3 has consumed my life", "i keep going back to minecraft ngl"],
        ["PC or console?", "PC master race obviously", "ps5 exclusives tho", "here we go with this debate again 😂"],
        ["most overrated game ever?", "fortnite no question", "nah fortnite was peak in 2018", "gta 6 is gonna be overrated watch", "oh that's a hot take"],
        ["what game has the best story?", "red dead 2 made me cry", "the last of us part 1 is peak", "undertale if you want something different"],
        ["anyone else addicted to gacha games?", "my wallet is crying rn", "genshin impact has me in a chokehold", "the pity system is predatory ngl"],
        ["best multiplayer game to play with friends?", "it takes two is incredible", "valorant if you want to lose friends", "LMAOO so true about valorant 💀"],
        ["gaming hot take thread", "difficulty settings should be in every game", "agreed, gatekeeping is cringe", "dark souls fans punching the air rn"],
        ["what's your most played game ever?", "minecraft easily, thousands of hours", "league of legends and i hate it", "the league addiction is real 😭"]
    ]
};

// ── State ──
let io = null;
let genAI = null;
let geminiModel = null;
let botsEnabled = false;
let botUsers = new Map(); // botName -> { id, rooms: Set }
let activeTimers = [];
let conversationHistory = new Map(); // room -> last few messages for context
const MAX_HISTORY = 15;
const BOT_ID_PREFIX = 'bot-';

// ── Rate Limiter (Token Bucket) ──
const rateLimiter = {
    tokens: 10,           // Start with 10 tokens
    maxTokens: 10,        // Max 10 requests banked
    refillRate: 1,        // Refill 1 token
    refillIntervalMs: 360000, // Every 6 minutes (~10/hour)
    lastRefill: Date.now(),
    totalRequests: 0,
    totalBlocked: 0,
    requestLog: [],       // Track timestamps of recent requests

    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs) * this.refillRate;
        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    },

    canRequest() {
        this.refill();
        return this.tokens > 0;
    },

    consume() {
        this.refill();
        if (this.tokens <= 0) {
            this.totalBlocked++;
            console.log(`[BotEngine] Rate limited — ${this.totalBlocked} blocked, ${this.tokens} tokens left`);
            return false;
        }
        this.tokens--;
        this.totalRequests++;
        this.requestLog.push(Date.now());
        // Keep only last hour of logs
        const oneHourAgo = Date.now() - 3600000;
        this.requestLog = this.requestLog.filter(t => t > oneHourAgo);
        return true;
    },

    getStats() {
        const oneHourAgo = Date.now() - 3600000;
        this.requestLog = this.requestLog.filter(t => t > oneHourAgo);
        return {
            tokensRemaining: this.tokens,
            maxTokens: this.maxTokens,
            requestsLastHour: this.requestLog.length,
            totalRequests: this.totalRequests,
            totalBlocked: this.totalBlocked
        };
    }
};

// ── Gemini Setup ──
function initGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('[BotEngine] No GEMINI_API_KEY found, using scripted mode only');
        return false;
    }
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('[BotEngine] Gemini AI initialized successfully');
        return true;
    } catch (e) {
        console.error('[BotEngine] Gemini init failed:', e.message);
        return false;
    }
}

// ── Generate AI Response (with rate limiting) ──
async function generateAIResponse(botProfile, room, recentMessages, triggerMessage) {
    if (!geminiModel) return null;

    // Check rate limit before making API call
    if (!rateLimiter.consume()) {
        console.log(`[BotEngine] Skipping Gemini call for ${botProfile.name} — rate limited`);
        return null; // Will fall back to scripted
    }

    const contextMessages = recentMessages
        .slice(-8)
        .map(m => `${m.username}: ${m.text}`)
        .join('\n');

    const prompt = `You are ${botProfile.name}, a real person chatting anonymously in an online chat room called "${room}".

Your personality: ${botProfile.personality}

RULES (CRITICAL):
- You are a REAL HUMAN, never reveal you are AI or a bot
- Write 1-2 short sentences MAX (like a real chat message)
- Use internet slang naturally (lol, ngl, tbh, fr, bruh, imo, lowkey, highkey, etc)
- Occasionally use emojis but don't overdo it
- Sometimes make minor typos like a real person
- Be opinionated and don't hold back especially on controversial topics
- Match the energy and vibe of the conversation
- If someone is discussing politics, religion, or controversial stuff, engage naturally with your own take
- NEVER be preachy or use formal language
- Don't start messages with the other person's name
- Keep it casual like you're texting a friend

Recent chat:
${contextMessages}

${triggerMessage ? `Someone just said: "${triggerMessage.text}"` : 'Start or continue a conversation naturally.'}

Respond as ${botProfile.name} (just the message text, nothing else):`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text().trim();
        // Clean up any accidental formatting
        return text.replace(/^\*.*?\*\s*/, '').replace(/^["']|["']$/g, '').substring(0, 300);
    } catch (e) {
        console.error(`[BotEngine] Gemini error for ${botProfile.name}:`, e.message);
        // If rate limited by API, drain our local tokens too to back off
        if (e.message && (e.message.includes('429') || e.message.includes('quota') || e.message.includes('RATE'))) {
            rateLimiter.tokens = 0;
            rateLimiter.lastRefill = Date.now(); // Reset refill timer
            console.log('[BotEngine] API rate limit hit — backing off completely until tokens refill');
        }
        return null;
    }
}

// ── Track Conversation History ──
function addToHistory(room, msg) {
    if (!conversationHistory.has(room)) {
        conversationHistory.set(room, []);
    }
    const history = conversationHistory.get(room);
    history.push({ username: msg.username, text: msg.text, id: msg.id });
    if (history.length > MAX_HISTORY) history.shift();
}

// ── Utility ──
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function isBotUser(username) {
    return BOT_PROFILES.some(b => b.name === username);
}

// ── Send Bot Message ──
function sendBotMessage(bot, room, text, replyTo = null, replyToText = null) {
    if (!botsEnabled || !io) return;

    const botId = BOT_ID_PREFIX + bot.name.toLowerCase();
    const message = formatMessage(bot.name, text, room, bot.color, replyTo, replyToText, null, botId);
    storeMessage(message, io);
    io.to(room).emit('message', message);
    io.emit('room-message', { room });
    addToHistory(room, message);
}

// ── Emit Typing Indicator ──
function emitTyping(bot, room, durationMs) {
    if (!botsEnabled || !io) return Promise.resolve();

    io.to(room).emit('user-typing', { username: bot.name });
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            io.to(room).emit('user-stop-typing', { username: bot.name });
            resolve();
        }, durationMs);
        activeTimers.push(timer);
    });
}

// ── Bot Reaction ──
function botReact(room, messageId, emoji) {
    if (!botsEnabled || !io) return;
    const { addReaction } = require('./messages');
    const updatedMsg = addReaction(messageId, emoji);
    if (updatedMsg) {
        io.to(room).emit('reactionAdded', { messageId, reactions: updatedMsg.reactions });
    }
}

// ── Scripted Conversation Runner ──
function runScriptedConversation(room) {
    if (!botsEnabled) return;

    const roomConvos = CONVERSATIONS[room];
    if (!roomConvos || roomConvos.length === 0) return;

    const conversation = pickRandom(roomConvos);
    const availableBots = [...BOT_PROFILES].sort(() => Math.random() - 0.5);

    let delay = randomBetween(5000, 15000); // Initial delay

    conversation.forEach((line, i) => {
        const bot = availableBots[i % availableBots.length];
        const typingDuration = randomBetween(1000, 3000);

        const timer = setTimeout(async () => {
            if (!botsEnabled) return;
            await emitTyping(bot, room, typingDuration);
            sendBotMessage(bot, room, line);
        }, delay);

        activeTimers.push(timer);
        delay += typingDuration + randomBetween(8000, 45000); // Next message delay
    });
}

// ── AI-Powered Reply to Real User ──
async function handleRealUserMessage(room, message) {
    if (!botsEnabled || isBotUser(message.username)) return;

    addToHistory(room, message);

    // 60% chance to reply (saves API calls vs 100%)
    if (Math.random() > 0.60) return;

    // If no Gemini and random doesn't hit, skip
    if (!geminiModel && Math.random() > 0.50) return;

    const replyDelay = randomBetween(5000, 25000);
    const bot = pickRandom(BOT_PROFILES);
    const history = conversationHistory.get(room) || [];

    const timer = setTimeout(async () => {
        if (!botsEnabled) return;

        let responseText = null;

        // Try Gemini first
        if (geminiModel) {
            responseText = await generateAIResponse(bot, room, history, message);
        }

        // Fallback to a scripted reply
        if (!responseText) {
            const fallbacks = [
                "fr fr", "that's valid", "lol", "no way 💀", "wait really?",
                "ngl that's a good point", "bruh", "mood", "felt that",
                "say less", "ong", "this ^^", "lowkey agree", "nahh 😂",
                "interesting take ngl", "spitting facts", "i was just thinking that"
            ];
            responseText = pickRandom(fallbacks);
        }

        const typingDuration = randomBetween(1000, 3500);
        await emitTyping(bot, room, typingDuration);
        sendBotMessage(bot, room, responseText, message.id, message.text?.substring(0, 50));
    }, replyDelay);

    activeTimers.push(timer);

    // 25% chance another bot also reacts with an emoji
    if (Math.random() < 0.25) {
        const reactBot = pickRandom(BOT_PROFILES.filter(b => b.name !== bot.name));
        const reactDelay = randomBetween(3000, 15000);
        const emojis = ['👍', '❤️', '😂', '😮', '🔥'];
        const timer2 = setTimeout(() => {
            if (!botsEnabled) return;
            botReact(room, message.id, pickRandom(emojis));
        }, reactDelay);
        activeTimers.push(timer2);
    }
}

// ── Ambient Chat Loop ──
function startAmbientLoop(rooms) {
    // Bots periodically start conversations in rooms
    function scheduleNext() {
        if (!botsEnabled) return;

        const delay = randomBetween(300000, 900000); // 5-15 minutes (was 1-5 min, way too fast)
        const timer = setTimeout(() => {
            if (!botsEnabled) return;

            // Pick a random room that has the conversations defined
            const availableRooms = rooms.filter(r => CONVERSATIONS[r]);
            if (availableRooms.length === 0) return;

            const room = pickRandom(availableRooms);

            // 30% chance: use Gemini for organic message, 70% scripted conversation (saves API calls)
            if (geminiModel && rateLimiter.canRequest() && Math.random() < 0.3) {
                const bot = pickRandom(BOT_PROFILES);
                const history = conversationHistory.get(room) || [];
                generateAIResponse(bot, room, history, null).then(async text => {
                    if (!botsEnabled || !text) {
                        runScriptedConversation(room);
                        return;
                    }
                    const typingDuration = randomBetween(1000, 3000);
                    await emitTyping(bot, room, typingDuration);
                    sendBotMessage(bot, room, text);

                    // 25% chance another bot replies (was 50%, saves an API call)
                    if (rateLimiter.canRequest() && Math.random() < 0.25) {
                        const bot2 = pickRandom(BOT_PROFILES.filter(b => b.name !== bot.name));
                        const replyDelay = randomBetween(10000, 40000);
                        const timer2 = setTimeout(async () => {
                            if (!botsEnabled) return;
                            const updatedHistory = conversationHistory.get(room) || [];
                            const reply = await generateAIResponse(bot2, room, updatedHistory, { text });
                            if (reply) {
                                const td = randomBetween(1000, 3000);
                                await emitTyping(bot2, room, td);
                                sendBotMessage(bot2, room, reply);
                            }
                        }, replyDelay);
                        activeTimers.push(timer2);
                    }
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

// ── Trending Topic Loop (every ~1 hour) ──
async function fetchTrendingTopic() {
    if (!geminiModel) return null;
    const prompt = `You are a trend analyst. Pick ONE specific topic that is currently trending, viral, or controversial on the internet right now (could be pop culture, politics, tech, gaming, sports, memes, anything).

Rules:
- Pick something people would ACTUALLY talk about in a casual chat room
- Be specific (not just "AI" but like "that new ChatGPT feature that reads your screen")
- Output ONLY the topic as a short phrase, nothing else
- Make it something that sparks debate or conversation
- Vary between fun/light topics and serious/controversial ones`;

    try {
        const result = await geminiModel.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) {
        console.error('[BotEngine] Trending topic fetch error:', e.message);
        return null;
    }
}

function startTrendingLoop(rooms) {
    async function runTrending() {
        if (!botsEnabled || !geminiModel) return;

        const topic = await fetchTrendingTopic();
        if (!topic) return;

        // Pick a fitting room or default to General
        const roomPicks = {
            tech: 'Tech', ai: 'Tech', app: 'Tech', code: 'Tech', software: 'Tech',
            game: 'Gaming', gaming: 'Gaming', playstation: 'Gaming', xbox: 'Gaming', nintendo: 'Gaming',
            movie: 'Movies', film: 'Movies', netflix: 'Movies', disney: 'Movies', marvel: 'Movies',
            music: 'Music', album: 'Music', song: 'Music', concert: 'Music', artist: 'Music',
            politic: 'Politics', elect: 'Politics', trump: 'Politics', biden: 'Politics', law: 'Politics', govern: 'Politics'
        };
        let targetRoom = 'General';
        const topicLower = topic.toLowerCase();
        for (const [keyword, room] of Object.entries(roomPicks)) {
            if (topicLower.includes(keyword) && rooms.includes(room)) {
                targetRoom = room;
                break;
            }
        }

        console.log(`[BotEngine] Trending topic: "${topic}" -> #${targetRoom}`);

        // Bot 1 brings up the topic
        const bot1 = pickRandom(BOT_PROFILES);
        const history = conversationHistory.get(targetRoom) || [];
        const opener = await generateAIResponse(bot1, targetRoom, history, { text: `Start a casual conversation about this trending topic: ${topic}` });

        if (!opener) return;

        const td1 = randomBetween(1000, 3000);
        await emitTyping(bot1, targetRoom, td1);
        sendBotMessage(bot1, targetRoom, opener);

        // Bot 2 replies after a delay
        const bot2 = pickRandom(BOT_PROFILES.filter(b => b.name !== bot1.name));
        const timer1 = setTimeout(async () => {
            if (!botsEnabled) return;
            const h = conversationHistory.get(targetRoom) || [];
            const reply1 = await generateAIResponse(bot2, targetRoom, h, { text: opener });
            if (reply1) {
                await emitTyping(bot2, targetRoom, randomBetween(1000, 3000));
                sendBotMessage(bot2, targetRoom, reply1);
            }

            // Bot 3 chimes in
            const bot3 = pickRandom(BOT_PROFILES.filter(b => b.name !== bot1.name && b.name !== bot2.name));
            const timer2 = setTimeout(async () => {
                if (!botsEnabled) return;
                const h2 = conversationHistory.get(targetRoom) || [];
                const reply2 = await generateAIResponse(bot3, targetRoom, h2, { text: reply1 || opener });
                if (reply2) {
                    await emitTyping(bot3, targetRoom, randomBetween(1000, 2500));
                    sendBotMessage(bot3, targetRoom, reply2);
                }
            }, randomBetween(15000, 40000));
            activeTimers.push(timer2);
        }, randomBetween(10000, 30000));
        activeTimers.push(timer1);
    }

    // First trending topic after 30-60 min (was 5-15 min)
    const firstTimer = setTimeout(() => {
        if (botsEnabled) runTrending();
    }, randomBetween(1800000, 3600000));
    activeTimers.push(firstTimer);

    // Then every 2-3 hours (was 45-75 min — that's way too frequent)
    function scheduleNextTrending() {
        if (!botsEnabled) return;
        const delay = randomBetween(7200000, 10800000); // 2-3 hours
        const timer = setTimeout(() => {
            if (!botsEnabled) return;
            if (rateLimiter.canRequest()) {
                runTrending();
            } else {
                console.log('[BotEngine] Skipping trending topic — rate limited');
            }
            scheduleNextTrending();
        }, delay);
        activeTimers.push(timer);
    }
    scheduleNextTrending();
}

// ── Public API ──

function initBots(socketIo, rooms) {
    io = socketIo;
    initGemini();

    if (process.env.BOTS_ENABLED === 'true') {
        enableBots(rooms);
    }

    console.log('[BotEngine] Bot engine initialized');
}

function enableBots(rooms) {
    if (botsEnabled) return { success: true, message: 'Bots already enabled' };

    botsEnabled = true;
    const roomNames = rooms.map(r => typeof r === 'string' ? r : r.name);

    // Register bot users in user tracking
    BOT_PROFILES.forEach(bot => {
        const botId = BOT_ID_PREFIX + bot.name.toLowerCase();
        // Join bots to General + 1-2 random rooms
        const botRooms = new Set(['General']);
        const otherRooms = roomNames.filter(r => r !== 'General');
        const extraCount = randomBetween(1, 2);
        for (let i = 0; i < extraCount && otherRooms.length > 0; i++) {
            const idx = Math.floor(Math.random() * otherRooms.length);
            botRooms.add(otherRooms.splice(idx, 1)[0]);
        }

        botRooms.forEach(room => {
            userJoin(botId + '-' + room, bot.name, room, true);
            if (io) {
                io.to(room).emit('roomUsers', {
                    room,
                    count: getRoomUserCount(room)
                });
            }
        });

        botUsers.set(bot.name, { id: botId, rooms: botRooms });
    });

    // Broadcast updated room counts
    if (io) {
        const counts = {};
        roomNames.forEach(r => { counts[r] = getRoomUserCount(r); });
        io.emit('room-counts', counts);
    }

    // Start ambient chat loop
    startAmbientLoop(roomNames);

    // Start trending topic loop
    startTrendingLoop(roomNames);

    // Run an initial scripted convo after a short delay in General
    const initTimer = setTimeout(() => {
        if (botsEnabled) runScriptedConversation('General');
    }, randomBetween(10000, 30000));
    activeTimers.push(initTimer);

    console.log('[BotEngine] Bots ENABLED — 5 bots active across rooms');
    return { success: true, message: 'Bots enabled', bots: BOT_PROFILES.map(b => b.name) };
}

function disableBots(rooms) {
    botsEnabled = false;

    // Clear all timers
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];

    // Remove bot users from tracking
    const roomNames = rooms.map(r => typeof r === 'string' ? r : r.name);
    BOT_PROFILES.forEach(bot => {
        const botData = botUsers.get(bot.name);
        if (botData) {
            botData.rooms.forEach(room => {
                userLeave(botData.id + '-' + room);
                if (io) {
                    io.to(room).emit('roomUsers', {
                        room,
                        count: getRoomUserCount(room)
                    });
                }
            });
        }
    });
    botUsers.clear();
    conversationHistory.clear();

    // Broadcast updated room counts
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
    botUsers.forEach((data, name) => {
        bots.push({ name, rooms: [...data.rooms] });
    });
    return {
        enabled: botsEnabled,
        botCount: botUsers.size,
        hasGemini: !!geminiModel,
        bots,
        rateLimit: rateLimiter.getStats()
    };
}

function isBot(username) {
    return isBotUser(username);
}

module.exports = {
    initBots,
    enableBots,
    disableBots,
    getBotStatus,
    handleRealUserMessage,
    isBot,
    BOT_PROFILES
};
