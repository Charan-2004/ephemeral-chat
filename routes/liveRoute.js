const { getPublicRooms } = require('../utils/roomManager');
const { getRoomUserCount } = require('../utils/users');
const { getRoomMessages } = require('../utils/messages');

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function createLivePage(req, res) {
    const io = req.app.get('io');
    const onlineCount = io ? io.engine.clientsCount : 0;
    const publicRooms = getPublicRooms().filter(r => !r.isPrivate && !r.locked && !r.isCustom);

    let allMessages = [];
    publicRooms.forEach(room => {
        const msgs = getRoomMessages(room.id)
            .filter(m => m.text && m.text.trim() && m.username !== 'System' && !m.isWhisper && !m.imageData)
            .slice(-15)
            .map(m => ({
                room: room.name,
                username: m.username,
                text: m.text.substring(0, 280),
                time: m.time || '',
                createdAt: m.createdAt || 0
            }));
        allMessages = allMessages.concat(msgs);
    });
    allMessages.sort((a, b) => b.createdAt - a.createdAt);
    allMessages = allMessages.slice(0, 60);

    const roomPills = publicRooms.map(r => {
        const count = getRoomUserCount(r.id);
        return '<div class="lv-room"><span class="lv-room-name">#' + escHtml(r.name) + '</span><span class="lv-room-count">' + count + ' online</span></div>';
    }).join('');

    const msgRows = allMessages.length > 0
        ? allMessages.map(m =>
            '<div class="lv-msg">' +
            '<span class="lv-badge">#' + escHtml(m.room) + '</span>' +
            '<strong class="lv-user">' + escHtml(m.username) + '</strong>' +
            '<span class="lv-text">' + escHtml(m.text) + '</span>' +
            '<span class="lv-time">' + escHtml(m.time) + '</span>' +
            '</div>'
        ).join('')
        : '<div class="lv-empty">No messages yet  <a href="/">be the first to chat!</a></div>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="30">
<title>Live Chat Feed  ChatHere |  People Online Now</title>
<meta name="description" content="Real-time anonymous chat on ChatHere.  people online now in General, Tech, Music, Movies, Gaming & Politics. No login required.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://chathere.online/live">
<meta property="og:title" content="Live Chat  ChatHere">
<meta property="og:description" content=" people chatting right now. Anonymous, no login needed.">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;background:#0d0d0f;color:#e0e0e0;min-height:100vh;line-height:1.5}
header{background:rgba(10,10,12,.98);border-bottom:1px solid rgba(255,255,255,.06);padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10;backdrop-filter:blur(10px)}
.brand{font-size:1.1rem;font-weight:800;color:#fff;text-decoration:none}
.live-pill{margin-left:auto;display:flex;align-items:center;gap:6px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);color:#34d399;padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:700}
.live-dot{width:7px;height:7px;background:#34d399;border-radius:50%;animation:blink 1.4s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.hero{max-width:880px;margin:48px auto 0;padding:0 24px;text-align:center}
.hero h1{font-size:2.2rem;font-weight:800;color:#fff;margin-bottom:10px;letter-spacing:-.02em}
.hero p{color:rgba(255,255,255,.5);font-size:1rem;margin-bottom:28px}
.online-pill{display:inline-flex;align-items:center;gap:8px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);color:#34d399;padding:10px 20px;border-radius:40px;font-size:.92rem;font-weight:700;margin-bottom:36px}
.rooms-bar{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:48px}
.lv-room{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:6px 16px;font-size:.82rem;display:flex;align-items:center;gap:10px}
.lv-room-name{color:#a5b1fc;font-weight:700}
.lv-room-count{color:rgba(255,255,255,.4);font-size:.75rem}
main{max-width:880px;margin:0 auto;padding:0 24px 80px}
.section-label{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:16px}
.lv-feed{display:flex;flex-direction:column;gap:8px}
.lv-msg{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);border-radius:10px;padding:12px 16px;display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}
.lv-msg:hover{background:rgba(255,255,255,.05)}
.lv-badge{font-size:.7rem;background:rgba(88,101,242,.15);color:#a5b1fc;border-radius:4px;padding:2px 8px;font-weight:700;white-space:nowrap;flex-shrink:0}
.lv-user{color:#fff;font-size:.88rem;white-space:nowrap;font-weight:600}
.lv-text{color:rgba(255,255,255,.68);font-size:.88rem;flex:1;word-break:break-word;min-width:0}
.lv-time{color:rgba(255,255,255,.22);font-size:.72rem;white-space:nowrap;margin-left:auto;flex-shrink:0}
.lv-empty{text-align:center;color:rgba(255,255,255,.3);padding:60px 0;font-size:.95rem}
.lv-empty a{color:#a5b1fc;text-decoration:none}
.cta{text-align:center;margin:56px 0 24px;padding:40px 24px;background:rgba(88,101,242,.06);border:1px solid rgba(88,101,242,.15);border-radius:20px}
.cta h2{font-size:1.4rem;font-weight:800;color:#fff;margin-bottom:8px}
.cta p{color:rgba(255,255,255,.45);font-size:.9rem;margin-bottom:24px}
.cta a{display:inline-block;background:linear-gradient(135deg,#5865f2,#7c3aed);color:#fff;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;font-size:1rem;transition:opacity .2s;box-shadow:0 8px 24px rgba(88,101,242,.3)}
.cta a:hover{opacity:.85}
.cta-note{margin-top:14px!important;color:rgba(255,255,255,.3)!important;font-size:.8rem!important}
footer{text-align:center;padding:28px;color:rgba(255,255,255,.22);font-size:.78rem;border-top:1px solid rgba(255,255,255,.05)}
footer a{color:rgba(255,255,255,.35);text-decoration:none;margin:0 10px}
footer a:hover{color:rgba(255,255,255,.6)}
@media(max-width:640px){.hero h1{font-size:1.6rem}.lv-time{display:none}}
</style>
</head>
<body>
<header><a href="/" class="brand">ChatHere</a><div class="live-pill"><div class="live-dot"></div>LIVE</div></header>
<div class="hero">
  <h1>What People Are Saying Right Now</h1>
  <p>Real-time anonymous conversations. No account needed.</p>
  <div class="online-pill">&#x1F7E2;  people online right now</div>
  <div class="rooms-bar"></div>
</div>
<main>
  <div class="section-label">Recent Messages</div>
  <div class="lv-feed"></div>
  <div class="cta"><h2>Join the Conversation</h2><p>Anonymous, ephemeral, completely free. Pick a name and start chatting in seconds.</p><a href="/">Start Chatting Now &rarr;</a><p class="cta-note">No login &bull; No registration &bull; 100% anonymous</p></div>
</main>
<footer><a href="/">Home</a><a href="/about.html">About</a><a href="/blog.html">Blog</a><p style="margin-top:12px">&copy; 2026 ChatHere &mdash; Anonymous chat, zero data collection.</p></footer>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.send(html);
}

module.exports = { createLivePage };
