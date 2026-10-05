const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const statePath = process.env.PUSH_STATE_PATH || path.join(__dirname, '..', 'data', 'push-state.json');
let savedState = {};
try {
    savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
} catch (err) {
    if (err.code !== 'ENOENT') console.error('[Push] Could not read push state:', err.message);
}
if (!savedState || typeof savedState !== 'object' || Array.isArray(savedState)) savedState = {};

const configuredKeys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;
let vapidPublicKey = configuredKeys ? process.env.VAPID_PUBLIC_KEY : savedState.vapidPublicKey;
let vapidPrivateKey = configuredKeys ? process.env.VAPID_PRIVATE_KEY : savedState.vapidPrivateKey;
if (!vapidPublicKey || !vapidPrivateKey) {
    const keys = webpush.generateVAPIDKeys();
    vapidPublicKey = keys.publicKey;
    vapidPrivateKey = keys.privateKey;
    console.warn('[Push] Generated persistent VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY explicitly when deploying multiple instances.');
}

webpush.setVapidDetails('mailto:legal@chathere.online', vapidPublicKey, vapidPrivateKey);

const subscriptions = new Map(
    Object.entries(savedState.subscriptions || {}).filter(([endpoint, subscription]) =>
        isValidSubscription(subscription) && endpoint === subscription.endpoint
    )
);
let persistenceWarningShown = false;

function isValidSubscription(subscription) {
    if (!subscription || typeof subscription !== 'object' || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) return false;
    try {
        return new URL(subscription.endpoint).protocol === 'https:' &&
            typeof subscription.keys?.p256dh === 'string' && subscription.keys.p256dh.length > 0 &&
            typeof subscription.keys?.auth === 'string' && subscription.keys.auth.length > 0;
    } catch (_) {
        return false;
    }
}

function persistState() {
    try {
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify({
            vapidPublicKey,
            vapidPrivateKey,
            subscriptions: Object.fromEntries(subscriptions)
        }), { encoding: 'utf8', mode: 0o600 });
        persistenceWarningShown = false;
        return true;
    } catch (err) {
        if (!persistenceWarningShown) {
            console.error('[Push] Could not persist push state. Configure a writable PUSH_STATE_PATH:', err.message);
            persistenceWarningShown = true;
        }
        return false;
    }
}

function getVapidPublicKey() { return vapidPublicKey; }

function addSubscription(subscription) {
    if (!isValidSubscription(subscription)) return false;
    if (!subscriptions.has(subscription.endpoint) && subscriptions.size >= 10000) return false;
    subscriptions.set(subscription.endpoint, subscription);
    persistState();
    console.log(`[Push] Subscriber added. Total: ${subscriptions.size}`);
    return true;
}

function removeSubscription(endpoint) {
    const removed = subscriptions.delete(endpoint);
    if (removed) persistState();
    return removed;
}

async function sendPushToAll(title, body, url) {
    url = url || '/';
    if (subscriptions.size === 0) return;
    const payload = JSON.stringify({ title, body, url });
    const toRemove = [];
    for (const [endpoint, subscription] of subscriptions.entries()) {
        try {
            await webpush.sendNotification(subscription, payload);
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) toRemove.push(endpoint);
        }
    }
    toRemove.forEach(removeSubscription);
    if (subscriptions.size > 0) console.log('[Push] Sent "' + title + '" to ' + subscriptions.size + ' subscribers');
}

function getSubscriptionCount() { return subscriptions.size; }

if (configuredKeys || !savedState.vapidPublicKey || !savedState.vapidPrivateKey) persistState();

module.exports = { getVapidPublicKey, addSubscription, removeSubscription, sendPushToAll, getSubscriptionCount };
