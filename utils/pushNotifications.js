const webpush = require('web-push');

// VAPID keys — ideally stored in .env; generated dynamically if missing
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
    const keys = webpush.generateVAPIDKeys();
    vapidPublicKey = keys.publicKey;
    vapidPrivateKey = keys.privateKey;
    console.log('[Push] Generated VAPID keys (add to .env to persist):');
    console.log('[Push] VAPID_PUBLIC_KEY=' + vapidPublicKey);
    console.log('[Push] VAPID_PRIVATE_KEY=' + vapidPrivateKey);
}

webpush.setVapidDetails(
    'mailto:legal@chathere.online',
    vapidPublicKey,
    vapidPrivateKey
);

// In-memory subscription store keyed by endpoint
const subscriptions = new Map();

function getVapidPublicKey() { return vapidPublicKey; }

function addSubscription(subscription) {
    if (!subscription || !subscription.endpoint) return;
    subscriptions.set(subscription.endpoint, subscription);
    console.log(`[Push] Subscriber added. Total: ${subscriptions.size}`);
}

function removeSubscription(endpoint) {
    subscriptions.delete(endpoint);
}

async function sendPushToAll(title, body, url) {
    url = url || '/';
    if (subscriptions.size === 0) return;
    const payload = JSON.stringify({ title, body, url });
    const toRemove = [];
    for (const [endpoint, sub] of subscriptions.entries()) {
        try {
            await webpush.sendNotification(sub, payload);
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) toRemove.push(endpoint);
        }
    }
    toRemove.forEach(ep => subscriptions.delete(ep));
    if (subscriptions.size > 0) console.log('[Push] Sent "' + title + '" to ' + subscriptions.size + ' subscribers');
}

function getSubscriptionCount() { return subscriptions.size; }

module.exports = { getVapidPublicKey, addSubscription, removeSubscription, sendPushToAll, getSubscriptionCount };