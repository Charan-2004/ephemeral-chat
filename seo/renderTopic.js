
const { escHtml, COMMON_CSS, renderHeader, renderFooter, getOnlineCount } = require('./seoStyles');

function renderTopicPage(topic, io) {
    const onlineCount = getOnlineCount(io);
    const faqs = [
        {
            question: 'Do I need an account to join?',
            answer: 'No account is required. Choose a display name and join a public topic room.'
        },
        {
            question: 'Are messages private or permanently deleted?',
            answer: 'No. Public-room messages can be read by other participants. The chat application keeps messages in server memory for delivery; they may remain until a server restart or storage-limit cleanup. Other people may copy messages.'
        },
        {
            question: 'Does ChatHere guarantee anonymity or safety?',
            answer: 'No. Joining without an account does not guarantee anonymity, and automated filters cannot prevent every harmful interaction. Do not share sensitive personal information; leave a conversation that makes you uncomfortable.'
        }
    ];
    const breadcrumbsJson = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://chathere.online/" },
            { "@type": "ListItem", "position": 2, "name": "Topics", "item": "https://chathere.online/chat" },
            { "@type": "ListItem", "position": 3, "name": topic.name, "item": `https://chathere.online/chat/topic/${topic.slug}` }
        ]
    };

    const faqJson = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": { "@type": "Answer", "text": f.answer }
        }))
    };

    const themesHtml = topic.keyThemes.map(t => `
      <div class="card">
        <div style="font-size:1.3rem;margin-bottom:8px">✨</div>
        <p style="font-weight:600;color:#fff">${escHtml(t)}</p>
      </div>
    `).join('');

    const startersHtml = topic.sampleStarters.map(s => `
      <div class="starter-bubble">"${escHtml(s)}"</div>
    `).join('');

    const faqsHtml = faqs.map(f => `
      <details class="faq-box">
        <summary>${escHtml(f.question)}</summary>
        <div class="faq-content">${escHtml(f.answer)}</div>
      </details>
    `).join('');

    const relatedHtml = (topic.relatedSlugs || []).map(s => `
      <a href="/chat/topic/${s}" class="link-pill">#${escHtml(s)}</a>
    `).join('');

    // Keep the topic landing pages specific to the actual product. Older copy
    // made broad claims about anonymity, moderation, and message deletion that
    // were not guaranteed by the implementation.
    const safeRoomName = escHtml(topic.name);
    const pageTitle = `${topic.name} Chat Room | ChatHere`;
    const pageDescription = `Join the public ${topic.name} chat room on ChatHere with a display name; no account is required. Messages are visible to participants.`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDescription)}">
<link rel="canonical" href="https://chathere.online/chat/topic/${topic.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(pageTitle)}">
<meta property="og:description" content="${escHtml(pageDescription)}">
<meta property="og:url" content="https://chathere.online/chat/topic/${topic.slug}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(pageTitle)}">
<meta name="twitter:description" content="${escHtml(pageDescription)}">
<meta name="twitter:image" content="https://chathere.online/preview-image.jpg?v=3">
<link rel="icon" type="image/png" href="/favicon.png">
<style>${COMMON_CSS}</style><link rel="stylesheet" href="/site-theme.css?v=1">
<script type="application/ld+json">${JSON.stringify(breadcrumbsJson)}</script>
<script type="application/ld+json">${JSON.stringify(faqJson)}</script>
</head>
<body>
${renderHeader(onlineCount)}
<div class="container">
  <div class="breadcrumbs">
    <a href="/">Home</a><span class="sep">/</span>
    <a href="/chat">Topics</a><span class="sep">/</span>
    <span>${escHtml(topic.name)}</span>
  </div>

  <div class="hero">
      <div class="hero-badge">${escHtml(topic.icon)} Public topic room</div>
      <h1>Join the ${safeRoomName} chat room</h1>
    <p class="subhead">Talk by text in a public room for people interested in ${safeRoomName}. No account is required.</p>
    <div class="online-indicator">
      <span class="nav-live-dot"></span>
      ${Number.isFinite(onlineCount) ? `${onlineCount} chatters online now across ChatHere` : 'Live activity updates as people join'}
    </div>
    <div>
      <a href="/?room=${encodeURIComponent(topic.room)}" class="btn-cta-large">
        Join #${escHtml(topic.room)} Room Now &rarr;
      </a>
      <div class="cta-subtext">No account required &bull; Free to use</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Key Discussions</div>
      <h2 class="section-title">What People Are Chatting About in ${escHtml(topic.name)}</h2>
    </div>
    <div class="grid-2">${themesHtml}</div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Conversation Starters</div>
      <h2 class="section-title">Jump In With These Discussion Openers</h2>
    </div>
    <div>${startersHtml}</div>
  </div>

  <div class="section card">
    <div class="section-header">
      <div class="section-tag">About this room</div>
      <h2 class="section-title">Chat about ${safeRoomName}</h2>
    </div>
    <div class="prose">
      <p>This is a public text room for people interested in ${safeRoomName}. The discussion themes and starter questions on this page are suggestions; they are not live messages or a promise that other participants are currently online.</p>
      <p>You can join without creating an account. Messages are held in server memory for delivery and may remain until a server restart or storage-limit cleanup. Other people in the room can read what you post, and they may copy it. Do not share passwords, contact details, financial information, or anything you need to keep private.</p>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">How It Works</div>
      <h2 class="section-title">How to join</h2>
    </div>
    <div class="grid-3">
      <div class="card">
        <div style="font-size:1.8rem;margin-bottom:10px">1️⃣</div>
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:6px">Pick a Temporary Name</h3>
        <p style="color:var(--text-muted);font-size:0.9rem">Choose a display name. No account or email signup is required.</p>
      </div>
      <div class="card">
        <div style="font-size:1.8rem;margin-bottom:10px">2️⃣</div>
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:6px">Join #${escHtml(topic.room)}</h3>
        <p style="color:var(--text-muted);font-size:0.9rem">Open the room and send a text message. Availability depends on your connection and the service.</p>
      </div>
      <div class="card">
        <div style="font-size:1.8rem;margin-bottom:10px">3️⃣</div>
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:6px">Know what is public</h3>
        <p style="color:var(--text-muted);font-size:0.9rem">Room messages are visible to participants and may remain in server memory until restart or storage-limit cleanup. Read <a href="/about.html">how ChatHere works</a>.</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Frequently Asked Questions</div>
      <h2 class="section-title">Everything You Need to Know</h2>
    </div>
    <div>${faqsHtml}</div>
  </div>

  <div class="internal-links">
    <h3 style="color:#fff;font-size:1rem;margin-bottom:4px">Related Topic Rooms</h3>
    <p style="color:var(--text-faint);font-size:0.85rem">Explore other active discussion channels:</p>
    <div class="link-pills">${relatedHtml}</div>
  </div>

  <div style="text-align:center;margin-top:56px">
    <a href="/?room=${encodeURIComponent(topic.room)}" class="btn-cta-large">
      Start Chatting in #${escHtml(topic.room)} &rarr;
    </a>
  </div>
</div>
${renderFooter()}
</body>
</html>`;
}

module.exports = { renderTopicPage };
