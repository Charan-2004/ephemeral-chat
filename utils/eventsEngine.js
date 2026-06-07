// Events Engine: manages scheduled daily rituals and reoccurring events in ET.
const { generateCustomBotResponse, sendBotMessage, emitTyping } = require('./botEngine');
const { getLeaderboard, recordMessage, updateAndCheckTop3 } = require('./leaderboard');
const { getRoomUsers } = require('./users');

let io = null;
let activeEvent = null;
let eventInterval = null;

// Event state variables
let triviaState = {
    active: false,
    questionNum: 0,
    currentQuestion: '',
    currentAnswer: '',
    scoreboard: new Map(), // username -> points
    waitingForAnswer: false,
    timer: null
};

let storyState = {
    active: false,
    storyLines: [],
    lastPromptTime: 0,
    waitingForUserLine: true
};

let debateState = {
    active: false,
    topic: '',
    lastModeratorCommentTime: 0
};

// Standard ET times (hours):
// 20:00 (8:00 PM) - Trivia Showdown
// 22:00 (10:00 PM) - Creative Co-Write
// 00:00 (12:00 AM) - Midnight Debate
const EVENTS = [
    { name: 'Midnight Debate', host: 'DebateBot', hour: 0, minute: 0, durationMins: 20 },
    { name: 'Trivia Showdown', host: 'TriviaHost', hour: 20, minute: 0, durationMins: 20 },
    { name: 'Creative Co-Write', host: 'StoryHost', hour: 22, minute: 0, durationMins: 20 }
];

// Timezone helper: get current Eastern Time (ET) components
function getCurrentET() {
    const options = {
        timeZone: 'America/New_York',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(new Date());
    const timeObj = {};
    parts.forEach(p => {
        timeObj[p.type] = p.value;
    });
    
    let hour = parseInt(timeObj.hour) || 0;
    if (hour === 24) hour = 0;
    
    return {
        year: parseInt(timeObj.year) || new Date().getFullYear(),
        month: parseInt(timeObj.month) || (new Date().getMonth() + 1),
        day: parseInt(timeObj.day) || new Date().getDate(),
        hour: hour,
        minute: parseInt(timeObj.minute) || 0,
        second: parseInt(timeObj.second) || 0
    };
}

// Timezone helper: get epoch timestamp for a given ET date/time
function getEpochMsFromET(year, month, day, hour, minute) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
    });
    
    // Guess the epoch time by starting from UTC time and adjusting iteratively.
    let testDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    for (let i = 0; i < 3; i++) {
        const formatted = formatter.formatToParts(testDate);
        const fObj = {};
        formatted.forEach(p => fObj[p.type] = p.value);
        
        let curHour = parseInt(fObj.hour) || 0;
        if (curHour === 24) curHour = 0;
        
        let curMin = parseInt(fObj.minute) || 0;
        
        const diffHours = hour - curHour;
        const diffMinutes = minute - curMin;
        testDate.setTime(testDate.getTime() + (diffHours * 60 + diffMinutes) * 60 * 1000);
    }
    return testDate.getTime();
}

// Compute active event or the next upcoming event
function getNextEventInfo() {
    const et = getCurrentET();
    const now = Date.now();
    
    let currentActive = null;
    let nextUpcoming = null;
    let minMs = Infinity;
    
    EVENTS.forEach(ev => {
        const todayMs = getEpochMsFromET(et.year, et.month, et.day, ev.hour, ev.minute);
        const tomorrowMs = todayMs + 24 * 60 * 60 * 1000;
        const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;
        
        [yesterdayMs, todayMs, tomorrowMs].forEach(targetMs => {
            const diff = targetMs - now;
            const durationMs = ev.durationMins * 60 * 1000;
            
            if (diff <= 0 && diff + durationMs > 0) {
                currentActive = {
                    name: ev.name,
                    host: ev.host,
                    timeRemaining: diff + durationMs,
                    startMs: targetMs
                };
            } else if (diff > 0 && diff < minMs) {
                minMs = diff;
                nextUpcoming = {
                    name: ev.name,
                    host: ev.host,
                    msUntil: diff,
                    startMs: targetMs
                };
            }
        });
    });
    
    return { activeEvent: currentActive, nextEvent: nextUpcoming };
}

// Initialize Daily Events Engine
function initEventsEngine(socketIo) {
    io = socketIo;
    console.log('[EventsEngine] Daily events engine initialized.');
    
    if (eventInterval) clearInterval(eventInterval);
    
    // Check event status every 10 seconds
    eventInterval = setInterval(() => {
        tickEventLoop();
    }, 10000);
}

// Tick event loop
function tickEventLoop() {
    if (!io) return;
    
    const { activeEvent: currentActive, nextEvent } = getNextEventInfo();
    
    if (currentActive) {
        // If an event is active but we haven't started it yet
        if (!activeEvent || activeEvent.name !== currentActive.name) {
            startEvent(currentActive);
        }
        
        // Broadcast active event info
        io.emit('event-status', {
            active: true,
            name: currentActive.name,
            host: currentActive.host,
            timeRemaining: currentActive.timeRemaining
        });
        
        // Execute event-specific tick actions
        runEventTick(currentActive.name);
    } else {
        // If no event is active, but we were running one
        if (activeEvent) {
            endEvent();
        }
        
        // Broadcast countdown to next event
        if (nextEvent) {
            io.emit('event-status', {
                active: false,
                name: nextEvent.name,
                host: nextEvent.host,
                msUntil: nextEvent.msUntil
            });
        }
    }
}

// Start an event
function startEvent(eventInfo) {
    activeEvent = eventInfo;
    console.log('[EventsEngine] Starting event: ' + eventInfo.name + ' hosted by ' + eventInfo.host);
    
    const hostProfile = { name: eventInfo.host, color: getHostColor(eventInfo.host) };
    
    if (eventInfo.name === 'Trivia Showdown') {
        triviaState = {
            active: true,
            questionNum: 0,
            currentQuestion: '',
            currentAnswer: '',
            scoreboard: new Map(),
            waitingForAnswer: false,
            timer: Date.now()
        };
        sendBotMessage(hostProfile, 'General', '\u{1F3C6} Welcome to the Daily Trivia Showdown! I am your host, TriviaHost. I will ask 5 trivia questions. The first person to answer correctly in chat wins points!');
    } else if (eventInfo.name === 'Creative Co-Write') {
        storyState = {
            active: true,
            storyLines: [],
            lastPromptTime: Date.now(),
            waitingForUserLine: true
        };
        sendBotMessage(hostProfile, 'General', '\u{270D}\u{FE0F} Welcome to the Creative Co-Write Hour! I am your host, StoryHost. Let\'s write a story together! I\'ll post a starting line, and you can suggest what happens next.');
    } else if (eventInfo.name === 'Midnight Debate') {
        debateState = {
            active: true,
            topic: '',
            lastModeratorCommentTime: Date.now()
        };
        triggerDebateOpener(hostProfile);
    }
}

// Run event-specific logic every tick (10s)
function runEventTick(eventName) {
    const hostProfile = { name: activeEvent.host, color: getHostColor(activeEvent.host) };
    
    if (eventName === 'Trivia Showdown') {
        if (!triviaState.waitingForAnswer && triviaState.questionNum < 5) {
            // Ask next question
            triviaState.questionNum++;
            askTriviaQuestion(hostProfile);
        } else if (triviaState.waitingForAnswer && Date.now() - triviaState.timer > 60000) {
            // Timeout question (60 seconds)
            sendBotMessage(hostProfile, 'General', '\u{23F0} Time\'s up! The correct answer was: ' + triviaState.currentAnswer + '. Moving to the next question...');
            triviaState.waitingForAnswer = false;
        }
    } else if (eventName === 'Creative Co-Write') {
        if (storyState.storyLines.length === 0) {
            // Kick off story
            triggerStoryOpener(hostProfile);
        } else if (Date.now() - storyState.lastPromptTime > 120000) {
            // Story idle nudge
            sendBotMessage(hostProfile, 'General', '\u{270D}\u{FE0F} Don\'t be shy! Write the next sentence of our story in chat.');
            storyState.lastPromptTime = Date.now();
        }
    }
}

// End an event
function endEvent() {
    console.log('[EventsEngine] Ending event: ' + activeEvent.name);
    const hostProfile = { name: activeEvent.host, color: getHostColor(activeEvent.host) };
    
    if (activeEvent.name === 'Trivia Showdown') {
        announceTriviaWinners(hostProfile);
    } else if (activeEvent.name === 'Creative Co-Write') {
        announceFinalStory(hostProfile);
    } else if (activeEvent.name === 'Midnight Debate') {
        sendBotMessage(hostProfile, 'General', '\u{1F3A4} That\'s all for tonight\'s Midnight Debate! Thank you all for sharing your thoughts. See you tomorrow!');
    }
    
    activeEvent = null;
    triviaState.active = false;
    storyState.active = false;
    debateState.active = false;
}

// Event Helpers: Trivia
async function askTriviaQuestion(hostProfile) {
    triviaState.waitingForAnswer = true;
    triviaState.timer = Date.now();
    
    await emitTyping(hostProfile, 'General', 2000);
    const prompt = 'Generate ONE interesting, fun, medium-difficulty trivia question. Also provide the single-word or very short answer (case-insensitive). Output strictly in this format: Question: [Question Text] | Answer: [Answer Text]';
    const response = await generateCustomBotResponse(hostProfile.name, prompt);
    
    if (response && response.includes('|')) {
        const parts = response.split('|');
        triviaState.currentQuestion = parts[0].replace('Question:', '').trim();
        triviaState.currentAnswer = parts[1].replace('Answer:', '').trim();
        sendBotMessage(hostProfile, 'General', '\u{2753} Question ' + triviaState.questionNum + ': ' + triviaState.currentQuestion);
    } else {
        // Fallback question
        triviaState.currentQuestion = 'What is the capital of France?';
        triviaState.currentAnswer = 'Paris';
        sendBotMessage(hostProfile, 'General', '\u{2753} Question ' + triviaState.questionNum + ': What is the capital of France?');
    }
}

function handleTriviaAnswer(username, userId, text) {
    if (!triviaState.active || !triviaState.waitingForAnswer) return;
    
    const cleanAnswer = triviaState.currentAnswer.toLowerCase().replace(/[.,-\/#!$%\^&\*;:{}=\-_~`()]/g, '').trim();
    const cleanText = text.toLowerCase().replace(/[.,-\/#!$%\^&\*;:{}=\-_~`()]/g, '').trim();
    
    if (cleanText.includes(cleanAnswer) || cleanAnswer.includes(cleanText) && cleanText.length > 2) {
        triviaState.waitingForAnswer = false;
        
        // Award points
        const points = triviaState.scoreboard.get(username) || 0;
        triviaState.scoreboard.set(username, points + 1);
        
        // Dynamics: increment their hourly leaderboard count!
        recordMessage('General', userId, username);
        updateAndCheckTop3('General');
        
        const hostProfile = { name: 'TriviaHost', color: getHostColor('TriviaHost') };
        sendBotMessage(hostProfile, 'General', '\u{1F389} Correct! @' + username + ' got it right. The answer was indeed: ' + triviaState.currentAnswer + '!');
    }
}

function announceTriviaWinners(hostProfile) {
    if (triviaState.scoreboard.size === 0) {
        sendBotMessage(hostProfile, 'General', '\u{1F3C6} The Trivia Showdown has ended, but there were no correct answers tonight. Better luck tomorrow!');
        return;
    }
    
    const sorted = [...triviaState.scoreboard.entries()].sort((a, b) => b[1] - a[1]);
    let scoreboardText = '\u{1F3C6} Trivia Showdown Scoreboard:\n';
    sorted.forEach(([user, pts], idx) => {
        scoreboardText += (idx + 1) + '. @' + user + ' - ' + pts + ' point' + (pts !== 1 ? 's' : '') + '\n';
    });
    
    sendBotMessage(hostProfile, 'General', scoreboardText.trim());
}

// Event Helpers: Story Co-Write
async function triggerStoryOpener(hostProfile) {
    await emitTyping(hostProfile, 'General', 2000);
    const prompt = 'Create the single opening sentence of a fun, imaginative, and mysterious story. Keep it engaging so users want to add to it.';
    const sentence = await generateCustomBotResponse(hostProfile.name, prompt) || 'It was a cold dark night when the streetlights in the General room started flashing green.';
    
    storyState.storyLines.push(sentence);
    storyState.lastPromptTime = Date.now();
    sendBotMessage(hostProfile, 'General', '\u{1F4D6} Here\'s the start of our story:\n\n"' + sentence + '"\n\n\u{270D}\u{FE0F} Reply with the next sentence to continue the story!');
}

async function handleStoryLine(username, text) {
    if (!storyState.active) return;
    
    const hostProfile = { name: 'StoryHost', color: getHostColor('StoryHost') };
    storyState.lastPromptTime = Date.now();
    
    // AI summarizes/weaves the sentence into the story
    await emitTyping(hostProfile, 'General', 3000);
    const context = storyState.storyLines.join(' ');
    const prompt = 'A user named @' + username + ' submitted this sentence to continue our story: "' + text + '".\nExisting story: "' + context + '"\nWrite a follow-up paragraph (2-3 sentences max) that incorporates their sentence beautifully into the story flow.';
    
    const paragraph = await generateCustomBotResponse(hostProfile.name, prompt);
    if (paragraph) {
        storyState.storyLines.push(text);
        storyState.storyLines.push(paragraph);
        sendBotMessage(hostProfile, 'General', '\u{270D}\u{FE0F} @' + username + ' added: "' + text + '"\n\n\u{1F4D6} Story update:\n' + paragraph + '\n\n\u{270D}\u{FE0F} What happens next?');
    }
}

function announceFinalStory(hostProfile) {
    if (storyState.storyLines.length <= 1) {
        sendBotMessage(hostProfile, 'General', '\u{1F4D6} The Story Co-Write has ended, but we didn\'t get many sentences. Let\'s try again tomorrow!');
        return;
    }
    
    const fullStory = storyState.storyLines.join(' ');
    sendBotMessage(hostProfile, 'General', '\u{1F4D6} The Story Co-Write Hour has ended! Here\'s our completed masterpiece:\n\n"' + fullStory + '"\n\n\u{2728} Incredible work everyone! Thank you for co-writing!');
}

// Event Helpers: Debate
async function triggerDebateOpener(hostProfile) {
    await emitTyping(hostProfile, 'General', 2000);
    const prompt = 'Pick a fun, engaging, and mildly controversial topic for a casual chatroom debate (e.g., Pineapple on pizza, is cereal a soup, Mac vs PC). State the topic and ask users to give their opinions.';
    const topic = await generateCustomBotResponse(hostProfile.name, prompt) || 'Is soup a drink or a food? Let\'s debate!';
    
    debateState.topic = topic;
    debateState.lastModeratorCommentTime = Date.now();
    sendBotMessage(hostProfile, 'General', '\u{1F3A4} Midnight Debate is now LIVE!\n\nTopic: ' + topic + '\n\nShare your stance in chat!');
}

async function handleDebateComment(username, text) {
    if (!debateState.active) return;
    
    // DebateBot replies occasionally (every 60-90s max)
    if (Date.now() - debateState.lastModeratorCommentTime < 60000) return;
    
    const hostProfile = { name: 'DebateBot', color: getHostColor('DebateBot') };
    debateState.lastModeratorCommentTime = Date.now();
    
    await emitTyping(hostProfile, 'General', 2500);
    const prompt = 'The topic of the debate is: "' + debateState.topic + '".\nUser @' + username + ' just commented: "' + text + '".\nReply to them in a friendly, conversational way, play devil\'s advocate, and keep the debate going.';
    
    const reply = await generateCustomBotResponse(hostProfile.name, prompt);
    if (reply) {
        sendBotMessage(hostProfile, 'General', reply);
    }
}

// General Helper
function getHostColor(hostName) {
    if (hostName === 'TriviaHost') return '#FFD700';
    if (hostName === 'StoryHost') return '#DDA0DD';
    if (hostName === 'DebateBot') return '#E67E22';
    return '#888';
}

module.exports = {
    initEventsEngine,
    handleTriviaAnswer,
    handleStoryLine,
    handleDebateComment,
    getCurrentET,
    getNextEventInfo,
    triviaActive: () => triviaState.active,
    storyActive: () => storyState.active,
    debateActive: () => debateState.active
};
