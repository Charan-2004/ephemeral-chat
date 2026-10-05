const { escHtml, COMMON_CSS, renderHeader, renderFooter } = require('./seoStyles');

function renderComparisonPage(comp) {
    const url = `https://chathere.online/vs/${comp.slug}`;
    const title = `ChatHere and ${comp.competitorName}: feature checklist`;
    const description = `A neutral checklist for comparing ChatHere with ${comp.competitorName}. Current competitor features and policies have not been verified on this page.`;
    const breadcrumbsJson = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://chathere.online/' },
            { '@type': 'ListItem', position: 2, name: 'Comparisons', item: 'https://chathere.online/vs' },
            { '@type': 'ListItem', position: 3, name: `${comp.competitorName} feature checklist`, item: url }
        ]
    };
    const checklist = [
        ['Chat format', 'ChatHere provides public topic-based text rooms. Check the other service’s current formats and room model.'],
        ['Joining', 'ChatHere lets visitors join without creating an account. Check the other service’s current sign-up requirements.'],
        ['Message handling', 'ChatHere holds messages in server memory for delivery; they may remain until restart or storage-limit cleanup. Review both services’ current privacy policies.'],
        ['Safety and moderation', 'Review each service’s current community rules, reporting tools, and moderation practices. No chat service should be assumed risk-free.'],
        ['Availability and price', 'Confirm current access, supported devices, and pricing directly with each service.']
    ];
    const rows = checklist.map(([topic, detail]) => `
      <li class="card"><h3 style="color:#fff;margin-bottom:8px">${escHtml(topic)}</h3><p style="color:var(--text-muted)">${escHtml(detail)}</p></li>
    `).join('');

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
  <div class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><a href="/vs">Comparisons</a><span class="sep">/</span><span>${escHtml(comp.competitorName)}</span></div>
  <section class="hero">
    <div class="hero-badge">Comparison checklist · under review</div>
    <h1>ChatHere and ${escHtml(comp.competitorName)}: what to compare</h1>
    <p class="subhead">This page does not verify or endorse current ${escHtml(comp.competitorName)} features, pricing, safety, or privacy practices. Check its official materials before deciding.</p>
  </section>
  <section class="section">
    <div class="section-header"><div class="section-tag">For a fair comparison</div><h2 class="section-title">Check current details for both services</h2></div>
    <ul class="grid-2" style="list-style:none">${rows}</ul>
  </section>
  <section class="section card">
    <div class="section-header"><div class="section-tag">ChatHere facts</div><h2 class="section-title">What this repo confirms</h2></div>
    <ul class="feature-list">
      <li class="feature-item">ChatHere has public, topic-based chat rooms.</li>
      <li class="feature-item">Joining does not require an account.</li>
      <li class="feature-item">Messages are held in server memory for live delivery and are not written to a persistent message database by the chat application.</li>
      <li class="feature-item">Public-room messages can be read by other room participants; this is not end-to-end encrypted private messaging.</li>
    </ul>
  </section>
  <p><a href="/vs">Back to comparisons</a> · <a href="/about.html">About ChatHere</a></p>
</main>
${renderFooter()}
</body>
</html>`;
}

module.exports = { renderComparisonPage };
