const { escHtml, COMMON_CSS, renderHeader, renderFooter } = require('./seoStyles');

function renderCityPage(city) {
    const url = `https://chathere.online/chat/city/${city.slug}`;
    const title = `City-themed chat: ${city.name} | ChatHere`;
    const description = `A city-themed conversation page for ${city.name}. ChatHere does not verify participant locations or guarantee local users.`;
    const breadcrumbsJson = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://chathere.online/' },
            { '@type': 'ListItem', position: 2, name: 'Cities', item: 'https://chathere.online/cities' },
            { '@type': 'ListItem', position: 3, name: city.name, item: url }
        ]
    };
    const topicIdeas = (city.popularLocalTopics || []).map(topic =>
        `<li class="feature-item"><span>${escHtml(topic)}</span></li>`
    ).join('');
    const starterIdeas = (city.sampleStarters || []).map(starter =>
        `<blockquote class="starter-bubble">“${escHtml(starter)}”</blockquote>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<link rel="icon" type="image/png" href="/favicon.png">
<style>${COMMON_CSS}</style><link rel="stylesheet" href="/site-theme.css?v=1">
<script type="application/ld+json">${JSON.stringify(breadcrumbsJson)}</script>
</head>
<body>
${renderHeader(null)}
<main class="container">
  <div class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><a href="/cities">Cities</a><span class="sep">/</span><span>${escHtml(city.name)}</span></div>
  <section class="hero">
    <div class="hero-badge">City-themed chat idea</div>
    <h1>Start a conversation about ${escHtml(city.name)}</h1>
    <p class="subhead">This page opens ChatHere’s global General room. ChatHere does not check where participants are located, and there may not be anyone else discussing this city.</p>
    <a href="/?room=General" class="btn-cta-large">Open the public chat room &rarr;</a>
  </section>
  <section class="section card">
    <div class="section-header"><div class="section-tag">Conversation ideas</div><h2 class="section-title">Possible topics about ${escHtml(city.name)}</h2></div>
    <p class="prose">These are suggested prompts, not live activity, verified local reporting, or claims about what residents are discussing.</p>
    <ul class="feature-list">${topicIdeas}</ul>
  </section>
  <section class="section">
    <div class="section-header"><div class="section-tag">Example openers</div><h2 class="section-title">Questions you could ask</h2></div>
    ${starterIdeas}
  </section>
  <section class="section card">
    <div class="section-header"><div class="section-tag">How chat works</div><h2 class="section-title">A few things to know</h2></div>
    <ul class="feature-list">
      <li class="feature-item">Anyone can join; the service does not verify that a participant lives in ${escHtml(city.name)}.</li>
      <li class="feature-item">Messages in public rooms are visible to other room participants.</li>
      <li class="feature-item">Messages are held in server memory for delivery and may remain until a restart or storage-limit cleanup.</li>
      <li class="feature-item">Avoid sharing personal or sensitive information in chat.</li>
    </ul>
  </section>
  <p><a href="/cities">Back to city-themed chat ideas</a> · <a href="/about.html">About ChatHere</a></p>
</main>
${renderFooter()}
</body>
</html>`;
}

module.exports = { renderCityPage };
