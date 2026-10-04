
const { escHtml, COMMON_CSS, renderHeader, renderFooter } = require('./seoStyles');
const allCities = require('../data/seoCities');

function renderCityPage(city, io) {
    const onlineCount = io ? io.engine.clientsCount : 42;
    const breadcrumbsJson = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://chathere.online/" },
            { "@type": "ListItem", "position": 2, "name": "Cities", "item": "https://chathere.online/cities" },
            { "@type": "ListItem", "position": 3, "name": city.name, "item": `https://chathere.online/chat/city/${city.slug}` }
        ]
    };

    const faqJson = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": city.faqs.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": { "@type": "Answer", "text": f.answer }
        }))
    };

    const topicsHtml = city.popularLocalTopics.map(t => `
      <li class="feature-item"><span class="check">✓</span><span>${escHtml(t)}</span></li>
    `).join('');

    const startersHtml = city.sampleStarters.map(s => `
      <div class="starter-bubble">"${escHtml(s)}"</div>
    `).join('');

    const faqsHtml = city.faqs.map(f => `
      <details class="faq-box">
        <summary>${escHtml(f.question)}</summary>
        <div class="faq-content">${escHtml(f.answer)}</div>
      </details>
    `).join('');

    const relatedHtml = (city.relatedCities || []).filter(slug => allCities.some(item => item.slug === slug)).map(c => `
      <a href="/chat/city/${c}" class="link-pill">${escHtml(c.replace(/-/g, ' ').toUpperCase())}</a>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(city.title)}</title>
<meta name="description" content="${escHtml(city.metaDescription)}">
<link rel="canonical" href="https://chathere.online/chat/city/${city.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(city.title)}">
<meta property="og:description" content="${escHtml(city.metaDescription)}">
<meta property="og:url" content="https://chathere.online/chat/city/${city.slug}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(city.title)}">
<meta name="twitter:description" content="${escHtml(city.metaDescription)}">
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
    <a href="/cities">Cities</a><span class="sep">/</span>
    <span>${escHtml(city.name)}</span>
  </div>

  <div class="hero">
    <div class="hero-badge">${escHtml(city.flag)} ${escHtml(city.country)} &bull; ${escHtml(city.timezone)}</div>
    <h1>${escHtml(city.headline)}</h1>
    <p class="subhead">${escHtml(city.subheadline)}</p>
    <div class="online-indicator">
      <span class="nav-live-dot"></span>
      ${onlineCount} people online in global rooms
    </div>
    <div>
      <a href="/?room=General" class="btn-cta-large">
        Enter ${escHtml(city.name)} Chat Room &rarr;
      </a>
      <div class="cta-subtext">No login &bull; No GPS required &bull; 100% Anonymous</div>
    </div>
  </div>

  <div class="section card">
    <div class="section-header">
      <div class="section-tag">City Life & Culture</div>
      <h2 class="section-title">The Local Beat of ${escHtml(city.name)}</h2>
    </div>
    <div class="prose">
      <p>${escHtml(city.localVibe)}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Popular Discussions</div>
      <h2 class="section-title">What Locals & Expats Are Talking About</h2>
    </div>
    <div class="card">
      <ul class="feature-list">${topicsHtml}</ul>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Icebreakers</div>
      <h2 class="section-title">Kick Off a Conversation</h2>
    </div>
    <div>${startersHtml}</div>
  </div>

  <div class="section card">
    <div class="section-header">
      <div class="section-tag">Why Anonymous?</div>
      <h2 class="section-title">Why Chatting Anonymously in ${escHtml(city.name)} Beats Social Media</h2>
    </div>
    <div class="prose">
      <p>${escHtml(city.whyLocalAnonymity)}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Local FAQs</div>
      <h2 class="section-title">Frequently Asked Questions</h2>
    </div>
    <div>${faqsHtml}</div>
  </div>

  <div class="internal-links">
    <h3 style="color:#fff;font-size:1rem;margin-bottom:4px">Explore Other Global City Hubs</h3>
    <div class="link-pills">${relatedHtml}</div>
  </div>

  <div style="text-align:center;margin-top:56px">
    <a href="/?room=General" class="btn-cta-large">
      Join ${escHtml(city.name)} Chat Now &rarr;
    </a>
  </div>
</div>
${renderFooter()}
</body>
</html>`;
}

module.exports = { renderCityPage };
