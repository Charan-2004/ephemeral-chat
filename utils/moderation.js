const BANNED_WORDS = [
    // Racism / Severe Slurs
    'nigger', 'nigga', 'faggot', 'chink', 'spic', 'kike', 'gook', 'wetback', 'tranny',
    
    // Child Abuse / Illicit Content
    'child porn', 'cp link', 'pedophile', 'pedo ', 'loli', 

    // Terrorism / Extreme Violence
    'bomb the', 'mass shooting', 'school shooting', 'kill all', 'isis', 'al qaeda', 'jihad'
];

function isMessageSafe(text) {
    if (!text) return true;
    const lowerText = text.toLowerCase();
    
    // Simple substring match for severe policy violations
    for (let word of BANNED_WORDS) {
        if (lowerText.includes(word)) {
            return false;
        }
    }
    return true;
}

module.exports = {
    isMessageSafe
};
