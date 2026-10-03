
const { escHtml, COMMON_CSS, renderHeader, renderFooter } = require('./seoStyles');

function renderUseCasePage(uc, io) {
    const onlineCount = io ? io.engine.clientsCount : 42;
    const breadcrumbsJson = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://chathere.online/" },
            { "@type": "ListItem", "position": 2, "name": "Use Cases", "item": "https://chathere.online/use-cases" },
            { "@type": "ListItem", "position": 3, "name": uc.name, "item": `https://chathere.online/use-cases/${uc.slug}` }
        ]
    };

    const faqJson = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": uc.faqs.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": { "@type": "Answer", "text": f.answer }
        }))
    };

    const benefitsHtml = uc.coreBenefits.map(b => `
      <li class="feature-item"><span class="check">✓</span><span>${escHtml(b)}</span></li>
    `).join('');

    const stepsHtml = uc.stepByStepGuide.map(s => `
      <div class="card">
        <p style="font-weight:600;color:#fff">${escHtml(s)}</p>
      </div>
    `).join('');

    const safetyHtml = uc.safetyTips.map(st => `
      <li class="feature-item"><span class="check">🛡️</span><span>${escHtml(st)}</span></li>
    `).join('');

    const faqsHtml = uc.faqs.map(f => `
      <details class="faq-box">
        <summary>${escHtml(f.question)}</summary>
        <div class="faq-content">${escHtml(f.answer)}</div>
      </details>
    `).join('');

    const relatedHtml = (uc.relatedSlugs || []).map(r => `
      <a href="/use-cases/${r}" class="link-pill">${escHtml(r.replace(/-/g, ' '))}</a>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(uc.title)}</title>
<meta name="description" content="${escHtml(uc.metaDescription)}">
<link rel="canonical" href="https://chathere.online/use-cases/${uc.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(uc.title)}">
<meta property="og:description" content="${escHtml(uc.metaDescription)}">
<meta property="og:url" content="https://chathere.online/use-cases/${uc.slug}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(uc.title)}">
<meta name="twitter:description" content="${escHtml(uc.metaDescription)}">
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
    <a href="/use-cases">Use Cases</a><span class="sep">/</span>
    <span>${escHtml(uc.name)}</span>
  </div>

  <div class="hero">
    <div class="hero-badge">${escHtml(uc.icon)} Use Case Guide</div>
    <h1>${escHtml(uc.headline)}</h1>
    <p class="subhead">${escHtml(uc.subheadline)}</p>
    <div>
      <a href="/" class="btn-cta-large">
        Launch Chat Now &rarr;
      </a>
      <div class="cta-subtext">No registration &bull; Completely free &bull; Instant access</div>
    </div>
  </div>

  <div class="section card">
    <div class="section-header">
      <div class="section-tag">Context & Overview</div>
      <h2 class="section-title">Understanding the Need</h2>
    </div>
    <div class="prose">
      ${uc.overview.split('\n\n').map(p => `<p>${escHtml(p)}</p>`).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Core Advantages</div>
      <h2 class="section-title">Why Ephemeral Chat Works Best</h2>
    </div>
    <div class="card">
      <ul class="feature-list">${benefitsHtml}</ul>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">Actionable Guide</div>
      <h2 class="section-title">How to Get Started</h2>
    </div>
    <div class="grid-2">${stepsHtml}</div>
  </div>

  <div class="section card">
    <div class="section-header">
      <div class="section-tag">Safety & Boundaries</div>
      <h2 class="section-title">Privacy Rules to Follow</h2>
    </div>
    <ul class="feature-list">${safetyHtml}</ul>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-tag">FAQs</div>
      <h2 class="section-title">Frequently Asked Questions</h2>
    </div>
    <div>${faqsHtml}</div>
  </div>

  <div class="internal-links">
    <h3 style="color:#fff;font-size:1rem;margin-bottom:4px">Related Guides & Use Cases</h3>
    <div class="link-pills">${relatedHtml}</div>
  </div>

  <div style="text-align:center;margin-top:56px">
    <a href="/" class="btn-cta-large">
      Start Chatting Anonymously &rarr;
    </a>
  </div>
</div>
${renderFooter()}
</body>
</html>`;
}

module.exports = { renderUseCasePage };
