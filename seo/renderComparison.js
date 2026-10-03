
const { escHtml, COMMON_CSS, renderHeader, renderFooter } = require('./seoStyles');

function renderComparisonPage(comp, io) {
    const onlineCount = io ? io.engine.clientsCount : 42;
    const breadcrumbsJson = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://chathere.online/" },
            { "@type": "ListItem", "position": 2, "name": "Comparisons", "item": "https://chathere.online/vs" },
            { "@type": "ListItem", "position": 3, "name": `ChatHere vs ${comp.competitorName}`, "item": `https://chathere.online/vs/${comp.slug}` }
        ]
    };

    const faqJson = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": comp.faqs.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": { "@type": "Answer", "text": f.answer }
        }))
    };

    const tableRows = comp.comparisonTable.map(r => `
      <tr>
        <td><strong>${escHtml(r.feature)}</strong></td>
        <td><span class="badge-check">✓ ${escHtml(r.chatHere)}</span></td>
        <td><span class="badge-cross">${escHtml(r.competitor)}</span></td>
      </tr>
    `).join('');

    const advantagesHtml = comp.keyAdvantages.map(a => `
      <li class="feature-item"><span class="check">✓</span><span>${escHtml(a)}</span></li>
    `).join('');

    const faqsHtml = comp.faqs.map(f => `
      <details class="faq-box">
        <summary>${escHtml(f.question)}</summary>
        <div class="faq-content">${escHtml(f.answer)}</div>
      </details>
    `).join('');

    const relatedHtml = (comp.relatedComparisons || []).map(c => `
      <a href="/vs/${c}" class="link-pill">vs ${escHtml(c.replace(/-/g, ' ').toUpperCase())}</a>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(comp.title)}</title>
<meta name="description" content="${escHtml(comp.metaDescription)}">
<link rel="canonical" href="https://chathere.online/vs/${comp.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(comp.title)}">
<meta property="og:description" content="${escHtml(comp.metaDescription)}">
<meta property="og:url" content="https://chathere.online/vs/${comp.slug}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(comp.title)}">
<meta name="twitter:description" content="${escHtml(comp.metaDescription)}">
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
    <a href="/vs">Comparisons</a><span class="sep">/</span>
    <span>vs ${escHtml(comp.competitorName)}</span>
  </div>

  <div class="hero">
    <div class="hero-badge">Side-by-Side Comparison</div>
    <h1>${escHtml(comp.headline)}</h1>
    <p class="subhead">${escHtml(comp.subheadline)}</p>
    <div>
      <a href="/" class="btn-cta-large">
        Try ChatHere Free Now &rarr;
      </a>
      <div class="cta-subtext">No download &bull; Zero login &bull; Safe text chat</div>
    </div>
  </div>

  <div class="section card">
    <div class="section-header">
      <div class="section-tag">Overview</div>
      <h2 class="section-title">The Shift from ${escHtml(comp.competitorName)} to ChatHere</h2>
    </div>
    <div class="prose">
      ${comp.overview.split('\n\n').map(p => `<p>${escHtml(p)}</p>`).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Feature Matrix</div>
      <h2 class="section-title">ChatHere vs. ${escHtml(comp.competitorName)} Breakdown</h2>
    </div>
    <div class="table-wrap">
      <table class="comp-table">
        <thead>
          <tr>
            <th>Feature / Consideration</th>
            <th>ChatHere (Official)</th>
            <th>${escHtml(comp.competitorName)}</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Key Advantages</div>
      <h2 class="section-title">Why Users Prefer ChatHere</h2>
    </div>
    <div class="card">
      <ul class="feature-list">${advantagesHtml}</ul>
    </div>
  </div>

  <div class="section grid-2">
    <div class="card">
      <h3 style="color:#fff;font-size:1.15rem;margin-bottom:10px">When to Choose ChatHere</h3>
      <p style="color:var(--text-muted);font-size:0.95rem">${escHtml(comp.whenToUseChatHere)}</p>
    </div>
    <div class="card">
      <h3 style="color:#fff;font-size:1.15rem;margin-bottom:10px">When ${escHtml(comp.competitorName)} Might Be Used</h3>
      <p style="color:var(--text-muted);font-size:0.95rem">${escHtml(comp.whenCompetitorMightBeUsed)}</p>
    </div>
  </div>

  <div class="section card">
    <div class="section-header">
      <div class="section-tag">Final Verdict</div>
      <h2 class="section-title">The Bottom Line</h2>
    </div>
    <div class="prose">
      <p>${escHtml(comp.verdict)}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">FAQs</div>
      <h2 class="section-title">Frequently Asked Questions</h2>
    </div>
    <div>${faqsHtml}</div>
  </div>

  <div class="internal-links">
    <h3 style="color:#fff;font-size:1rem;margin-bottom:4px">Compare Other Platforms</h3>
    <div class="link-pills">${relatedHtml}</div>
  </div>

  <div style="text-align:center;margin-top:56px">
    <a href="/" class="btn-cta-large">
      Start Chatting on ChatHere &rarr;
    </a>
  </div>
</div>
${renderFooter()}
</body>
</html>`;
}

module.exports = { renderComparisonPage };
