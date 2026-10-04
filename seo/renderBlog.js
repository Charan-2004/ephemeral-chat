
const { escHtml, COMMON_CSS, renderHeader, renderFooter, getOnlineCount } = require('./seoStyles');

function renderBlogPage(blog) {
    if (!blog.editoriallyReviewed) return renderHeldBlogPage(blog);
    const url = `https://chathere.online/blog/${blog.slug}`;
    const breadcrumbsJson = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://chathere.online/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://chathere.online/blog' },
            { '@type': 'ListItem', position: 3, name: blog.title, item: url }
        ]
    };
    const body = blog.sections.map((section, index) => {
        const citations = (section.sources || []).map(sourceIndex => {
            const source = blog.sources[sourceIndex];
            return `<sup><a href="#source-${sourceIndex + 1}" aria-label="Source ${sourceIndex + 1}">[${sourceIndex + 1}]</a></sup>`;
        }).join('');
        return `<section class="section"><h2>${escHtml(section.heading)}</h2><p class="prose">${escHtml(section.content)} ${citations}</p></section>`;
    }).join('');
    const sourceList = blog.sources.map((source, index) =>
        `<li id="source-${index + 1}"><a href="${escHtml(source.url)}" rel="noopener noreferrer">${escHtml(source.title)}</a> <span>(accessed ${escHtml(blog.date)})</span></li>`
    ).join('');
    const related = (blog.relatedBlogs || []).map(slug =>
        `<li><a href="/blog/${encodeURIComponent(slug)}">${escHtml(slug.replace(/-/g, ' '))}</a></li>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(blog.title)} | ChatHere</title>
<meta name="description" content="${escHtml(blog.metaDescription)}">
<meta name="author" content="${escHtml(blog.author)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/png" href="/favicon.png">
<style>${COMMON_CSS}</style>
<script type="application/ld+json">${JSON.stringify(breadcrumbsJson)}</script>
</head>
<body>
${renderHeader(null)}
<main class="container" style="max-width:820px">
  <div class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><a href="/blog">Blog</a><span class="sep">/</span><span>${escHtml(blog.title)}</span></div>
  <section class="hero">
    <div class="hero-badge">${escHtml(blog.category)}</div>
    <h1>${escHtml(blog.title)}</h1>
    <p class="subhead">${escHtml(blog.excerpt)}</p>
    <p>By ${escHtml(blog.author)} · Reviewed ${escHtml(blog.date)}</p>
  </section>
  ${body}
  <section class="section card"><h2>Sources and further reading</h2><ol>${sourceList}</ol><p>External claims are linked to their sources. ChatHere product details were checked against the current project implementation; see <a href="/about.html">About ChatHere</a> for the service description.</p></section>
  ${related ? `<section class="section"><h2>Related guides</h2><ul>${related}</ul></section>` : ''}
</main>
${renderFooter()}
</body>
</html>`;
}

function renderHeldBlogPage(blog) {
    const url = `https://chathere.online/blog/${blog.slug}`;
    const breadcrumbsJson = {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://chathere.online/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://chathere.online/blog' },
            { '@type': 'ListItem', position: 3, name: 'Editorial review', item: url }
        ]
    };
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guide under editorial review | ChatHere</title><meta name="description" content="This ChatHere guide is temporarily unavailable while its claims and sources are reviewed."><meta name="robots" content="noindex,follow"><link rel="canonical" href="${url}"><link rel="icon" type="image/png" href="/favicon.png"><style>${COMMON_CSS}</style><script type="application/ld+json">${JSON.stringify(breadcrumbsJson)}</script></head><body>${renderHeader(null)}<main class="container" style="max-width:820px"><div class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><a href="/blog">Blog</a><span class="sep">/</span><span>Editorial review</span></div><section class="hero"><div class="hero-badge">Editorial review</div><h1>This guide is temporarily unavailable</h1><p class="subhead">We are checking the article’s factual claims, adding reliable sources, and confirming that ChatHere product details match the current service. We’ll republish it after that review is complete.</p><a href="/about.html" class="btn-cta-large">Read how ChatHere works &rarr;</a></section></main>${renderFooter()}</body></html>`;
}

function renderHubPage(type, items, io) {
    const onlineCount = getOnlineCount(io);
    let title = "";
    let meta = "";
    let h1 = "";
    let subhead = "";
    let cardsHtml = "";

    if (type === 'topics') {
        title = "Browse Anonymous Chat Rooms by Topic | ChatHere";
        meta = "Explore 30+ free anonymous chat rooms across Tech, Gaming, Anime, Movies, Music, Politics, Books, and more. No login required.";
        h1 = "Explore Topic Chat Rooms";
        subhead = "Find communities that share your exact interests. Click any topic to see discussions or jump directly into the room.";
        cardsHtml = items.map(t => `
          <a href="/chat/topic/${t.slug}" class="card" style="display:block;text-decoration:none">
            <div style="font-size:1.8rem;margin-bottom:8px">${t.icon}</div>
            <h3 style="color:#fff;font-size:1.15rem;margin-bottom:6px">${escHtml(t.name)}</h3>
            <p style="color:var(--text-muted);font-size:0.88rem;line-height:1.5">${escHtml(t.subheadline)}</p>
            <div style="margin-top:12px;font-size:0.8rem;color:var(--primary);font-weight:700">Enter Room &rarr;</div>
          </a>
        `).join('');
    } else if (type === 'cities') {
        title = "City-themed Chat Ideas | ChatHere";
        meta = "Browse city-themed conversation prompts. ChatHere does not verify participant locations or guarantee that local users are present.";
        h1 = "City-themed conversation ideas";
        subhead = "These are prompts for starting a global chat, not verified local rooms or reports of current city activity.";
        cardsHtml = items.map(c => `
          <a href="/chat/city/${c.slug}" class="card" style="display:block;text-decoration:none">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:1.4rem" aria-hidden="true">${c.flag}</span>
            </div>
            <h3 style="color:#fff;font-size:1.15rem;margin-bottom:4px">${escHtml(c.name)}</h3>
            <div style="color:var(--text-faint);font-size:0.8rem;margin-bottom:8px">${escHtml(c.country)}</div>
            <p style="color:var(--text-muted);font-size:0.85rem;line-height:1.4">Example conversation prompts; local participation is not verified.</p>
          </a>
        `).join('');
    } else if (type === 'comparisons') {
        title = "Chat Service Comparison Checklists | ChatHere";
        meta = "Neutral checklists for evaluating chat format, account requirements, message handling, moderation, availability, and price.";
        h1 = "Chat service comparison checklists";
        subhead = "Competitor-specific pages are under review. Their current features and policies have not been verified here.";
        cardsHtml = items.map(c => `
          <a href="/vs/${c.slug}" class="card" style="display:block;text-decoration:none">
            <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px">${escHtml(c.competitorName)} checklist</h3>
            <p style="color:var(--text-muted);font-size:0.88rem;line-height:1.5">Review current official product and privacy information before comparing.</p>
            <div style="margin-top:12px;font-size:0.8rem;color:var(--primary);font-weight:700">Open checklist &rarr;</div>
          </a>
        `).join('');
    } else if (type === 'use-cases') {
        title = "Anonymous Chat Use Cases & Guides | ChatHere";
        meta = "Explore how people use ChatHere for emotional venting, insomnia companionship, developer pair debugging, language practice, and more.";
        h1 = "Real-World Use Cases";
        subhead = "Explore practical guides for using ChatHere in different situations, from coding discussions to late-night conversation.";
        cardsHtml = items.filter(u => !u.editorialHold).map(u => `
          <a href="/use-cases/${u.slug}" class="card" style="display:block;text-decoration:none">
            <div style="font-size:1.6rem;margin-bottom:8px">${u.icon}</div>
            <h3 style="color:#fff;font-size:1.15rem;margin-bottom:6px">${escHtml(u.name)}</h3>
            <p style="color:var(--text-muted);font-size:0.88rem;line-height:1.5">${escHtml(u.subheadline)}</p>
            <div style="margin-top:12px;font-size:0.8rem;color:var(--primary);font-weight:700">Read Practical Guide &rarr;</div>
          </a>
        `).join('');
    } else if (type === 'blog') {
        title = "ChatHere Guides: Online Privacy, Chat Safety, and Chat Technology";
        meta = "Source-linked guides about online privacy, safer public chat, ephemeral messages, and chat technology from ChatHere.";
        h1 = "Guides to online chat and privacy";
        subhead = "Practical, source-linked explainers. Each guide distinguishes published research and official guidance from ChatHere product details.";
        cardsHtml = items.filter(article => article.editoriallyReviewed).map(article => `
          <a href="/blog/${encodeURIComponent(article.slug)}" class="card" style="display:block;text-decoration:none">
            <h2 style="color:#fff;font-size:1.15rem;margin-bottom:8px">${escHtml(article.title)}</h2>
            <p style="color:var(--text-muted);font-size:0.88rem;line-height:1.5">${escHtml(article.excerpt)}</p>
            <div style="margin-top:12px;font-size:0.8rem;color:var(--primary);font-weight:700">Read guide &rarr;</div>
          </a>
        `).join('');
    }

    const hubRoutes = {
        topics: { path: '/chat', name: 'Topics' },
        cities: { path: '/cities', name: 'Cities' },
        comparisons: { path: '/vs', name: 'Comparisons' },
        'use-cases': { path: '/use-cases', name: 'Use Cases' },
        blog: { path: '/blog', name: 'Blog' }
    };
    const hub = hubRoutes[type];
    const breadcrumbsJson = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://chathere.online/' },
            { '@type': 'ListItem', position: 2, name: hub.name, item: `https://chathere.online${hub.path}` }
        ]
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(meta)}">
${['cities', 'comparisons'].includes(type) ? '<meta name="robots" content="noindex,follow">' : ''}
<link rel="canonical" href="https://chathere.online${hub.path}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(meta)}">
<meta property="og:url" content="https://chathere.online${hub.path}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(meta)}">
<link rel="icon" type="image/png" href="/favicon.png">
<style>${COMMON_CSS}</style>
<script type="application/ld+json">${JSON.stringify(breadcrumbsJson)}</script>
</head>
<body>
${renderHeader(onlineCount)}
<div class="container">
  <div class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><span>${escHtml(hub.name)}</span></div>
  <div class="hero">
    <div class="hero-badge">Directory Hub</div>
    <h1>${escHtml(h1)}</h1>
    <p class="subhead">${escHtml(subhead)}</p>
    <div class="online-indicator">
      <span class="nav-live-dot"></span>
      ${Number.isFinite(onlineCount) ? `${onlineCount} users online now across ChatHere` : 'Live activity updates as people join'}
    </div>
  </div>

  <div class="${type === 'blog' ? '' : (type === 'cities' ? 'grid-3' : 'grid-3')}">
    ${cardsHtml}
  </div>

  <div style="text-align:center;margin-top:64px">
    <a href="/" class="btn-cta-large">Jump Into Live Chat &rarr;</a>
  </div>
</div>
${renderFooter()}
</body>
</html>`;
}

module.exports = { renderBlogPage, renderHubPage };
