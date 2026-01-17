const predefinedTopics = [
    "🔥 Viral: AI Revolution",
    "🔥 Viral: Crypto Crash",
    "🔥 Viral: Mars Landing",
    "🔥 Viral: New Pandemic?",
    "🔥 Viral: Global Warming",
    "🔥 Viral: Tech Layoffs",
    "🔥 Viral: VR Gaming",
    "🔥 Viral: Quantum Leap",
    "🔥 Viral: Space Tourism",
    "🔥 Viral: Robot Rights"
];

let currentTrending = [];

function updateTrendingTopics() {
    // Pick 3 random topics
    const shuffled = predefinedTopics.sort(() => 0.5 - Math.random());
    currentTrending = shuffled.slice(0, 3);
    return currentTrending;
}

function getTrendingTopics() {
    return currentTrending;
}

// Initialize
updateTrendingTopics();

module.exports = {
    updateTrendingTopics,
    getTrendingTopics
};
