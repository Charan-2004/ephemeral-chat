
const { escHtml, COMMON_CSS, renderHeader, renderFooter } = require('./seoStyles');

function renderTopicPage(topic, io) {
    const onlineCount = io ? io.engine.clientsCount : 42;
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
        "mainEntity": topic.faqs.map(f => ({
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

    const faqsHtml = topic.faqs.map(f => `
      <details class="faq-box">
        <summary>${escHtml(f.question)}</summary>
        <div class="faq-content">${escHtml(f.answer)}</div>
      </details>
    `).join('');

    const relatedHtml = (topic.relatedSlugs || []).map(s => `
      <a href="/chat/topic/${s}" class="link-pill">#${escHtml(s)}</a>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(topic.title)}</title>
<meta name="description" content="${escHtml(topic.metaDescription)}">
<link rel="canonical" href="https://chathere.online/chat/topic/${topic.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(topic.title)}">
<meta property="og:description" content="${escHtml(topic.metaDescription)}">
<meta property="og:url" content="https://chathere.online/chat/topic/${topic.slug}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(topic.title)}">
<meta name="twitter:description" content="${escHtml(topic.metaDescription)}">
<meta name="twitter:image" content="https://chathere.online/preview-image.jpg?v=3">
<link rel="icon" type="image/png" href="/favicon.png">
<style>${COMMON_CSS}</style>
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
    <div class="hero-badge">${escHtml(topic.icon)} Live Topic Room</div>
    <h1>${escHtml(topic.headline)}</h1>
    <p class="subhead">${escHtml(topic.subheadline)}</p>
    <div class="online-indicator">
      <span class="nav-live-dot"></span>
      ${onlineCount} chatters online now across ChatHere
    </div>
    <div>
      <a href="/?room=${encodeURIComponent(topic.room)}" class="btn-cta-large">
        Join #${escHtml(topic.room)} Room Now &rarr;
      </a>
      <div class="cta-subtext">Zero registration &bull; No login &bull; 100% Ephemeral & Free</div>
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
      <div class="section-tag">Privacy & Psychology</div>
      <h2 class="section-title">Why Chat Anonymously About ${escHtml(topic.name)}?</h2>
    </div>
    <div class="prose">
      <p>${escHtml(topic.whyAnonymous)}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">How It Works</div>
      <h2 class="section-title">Three Seconds to Real Conversation</h2>
    </div>
    <div class="grid-3">
      <div class="card">
        <div style="font-size:1.8rem;margin-bottom:10px">1️⃣</div>
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:6px">Pick a Temporary Name</h3>
        <p style="color:var(--text-muted);font-size:0.9rem">No password, email, or identity verification. Use any alias you like.</p>
      </div>
      <div class="card">
        <div style="font-size:1.8rem;margin-bottom:10px">2️⃣</div>
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:6px">Join #${escHtml(topic.room)}</h3>
        <p style="color:var(--text-muted);font-size:0.9rem">Connect instantly via secure WebSockets with zero loading lag.</p>
      </div>
      <div class="card">
        <div style="font-size:1.8rem;margin-bottom:10px">3️⃣</div>
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:6px">Zero Footprint</h3>
        <p style="color:var(--text-muted);font-size:0.9rem">Messages vanish periodically from server RAM. Nothing is archived.</p>
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
