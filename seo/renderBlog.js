
const { escHtml, COMMON_CSS, renderHeader, renderFooter } = require('./seoStyles');

function renderBlogPage(blog, io) {
    const onlineCount = io ? io.engine.clientsCount : 42;
    const breadcrumbsJson = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://chathere.online/" },
            { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://chathere.online/blog" },
            { "@type": "ListItem", "position": 3, "name": blog.title, "item": `https://chathere.online/blog/${blog.slug}` }
        ]
    };

    const articleJson = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": blog.title,
        "description": blog.metaDescription,
        "author": {
            "@type": "Organization",
            "name": blog.author,
            "url": "https://chathere.online/about.html#editorial-team"
        },
        "publisher": {
            "@type": "Organization",
            "name": "ChatHere",
            "logo": { "@type": "ImageObject", "url": "https://chathere.online/logo.png" }
        },
        "datePublished": blog.date,
        "dateModified": blog.date,
        "mainEntityOfPage": `https://chathere.online/blog/${blog.slug}`,
        "image": "https://chathere.online/preview-image.jpg?v=3"
    };

    const faqJson = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": (blog.faqs || []).map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": { "@type": "Answer", "text": f.answer }
        }))
    };

    const tagsHtml = (blog.tags || []).map(t => `<span class="link-pill" style="font-size:0.75rem">${escHtml(t)}</span>`).join(' ');

    const sectionsHtml = blog.sections.map(s => `
      <div style="margin-bottom:36px">
        <h2 style="color:#fff;font-size:1.6rem;font-weight:800;margin-bottom:14px;letter-spacing:-.02em">${escHtml(s.heading)}</h2>
        <div class="prose">
          ${s.content.split('\n\n').map(p => `<p>${escHtml(p)}</p>`).join('')}
        </div>
      </div>
    `).join('');

    const faqsHtml = (blog.faqs || []).map(f => `
      <details class="faq-box">
        <summary>${escHtml(f.question)}</summary>
        <div class="faq-content">${escHtml(f.answer)}</div>
      </details>
    `).join('');

    const relatedHtml = (blog.relatedBlogs || []).map(r => `
      <a href="/blog/${r}" class="link-pill">${escHtml(r.replace(/-/g, ' '))}</a>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(blog.title)} | ChatHere</title>
<meta name="description" content="${escHtml(blog.metaDescription)}">
<link rel="canonical" href="https://chathere.online/blog/${blog.slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escHtml(blog.title)}">
<meta property="og:description" content="${escHtml(blog.metaDescription)}">
<meta property="og:url" content="https://chathere.online/blog/${blog.slug}">
<meta property="og:image" content="https://chathere.online/preview-image.jpg?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(blog.title)}">
<meta name="twitter:description" content="${escHtml(blog.metaDescription)}">
<meta name="twitter:image" content="https://chathere.online/preview-image.jpg?v=3">
<link rel="icon" type="image/png" href="/favicon.png">
<style>${COMMON_CSS}</style>
<script type="application/ld+json">${JSON.stringify(breadcrumbsJson)}</script>
<script type="application/ld+json">${JSON.stringify(articleJson)}</script>
<script type="application/ld+json">${JSON.stringify(faqJson)}</script>
</head>
<body>
${renderHeader(onlineCount)}
<div class="container" style="max-width:820px">
  <div class="breadcrumbs">
    <a href="/">Home</a><span class="sep">/</span>
    <a href="/blog">Blog</a><span class="sep">/</span>
    <span>${escHtml(blog.title)}</span>
  </div>

  <article>
    <div style="margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <span class="hero-badge" style="margin-bottom:0">${escHtml(blog.category)}</span>
        <span style="color:var(--text-faint);font-size:0.85rem">${escHtml(blog.date)}</span>
        <span style="color:var(--text-faint);font-size:0.85rem">&bull;</span>
        <span style="color:var(--text-faint);font-size:0.85rem">${escHtml(blog.readTime)}</span>
      </div>
      <h1 style="font-size:2.4rem;font-weight:800;color:#fff;line-height:1.2;letter-spacing:-.03em;margin-bottom:16px">${escHtml(blog.title)}</h1>
      <p style="font-size:1.15rem;color:var(--text-muted);line-height:1.6;font-style:italic;margin-bottom:16px">${escHtml(blog.excerpt)}</p>
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px">
        <div style="font-size:1.2rem">✍️</div>
        <div>
          <strong style="color:#fff;font-size:0.9rem"><a href="/about.html#editorial-team">${escHtml(blog.author)}</a></strong>
          <div style="color:var(--text-faint);font-size:0.75rem">Publisher of ChatHere guides on privacy and online communities</div>
        </div>
      </div>
    </div>

    ${sectionsHtml}

    ${blog.faqs && blog.faqs.length > 0 ? `
    <div class="section" style="margin-top:40px">
      <h3 style="color:#fff;font-size:1.3rem;font-weight:800;margin-bottom:16px">Frequently Asked Questions</h3>
      <div>${faqsHtml}</div>
    </div>
    ` : ''}

    <div class="internal-links" style="margin-top:40px">
      <h3 style="color:#fff;font-size:1rem;margin-bottom:6px">Tags & Related Reads</h3>
      <div style="margin-bottom:12px">${tagsHtml}</div>
      <div class="link-pills">${relatedHtml}</div>
    </div>

    <div style="background:linear-gradient(135deg,rgba(88,101,242,0.1),rgba(124,58,237,0.1));border:1px solid rgba(88,101,242,0.25);border-radius:16px;padding:36px;text-align:center;margin-top:56px">
      <h3 style="color:#fff;font-size:1.4rem;font-weight:800;margin-bottom:8px">Experience Anonymous Chat Today</h3>
      <p style="color:var(--text-muted);font-size:0.95rem;max-width:560px;margin:0 auto 20px">No accounts, no email verification, no algorithms. Join active rooms in seconds.</p>
      <a href="/" class="btn-cta-large">Start Chatting Now &rarr;</a>
    </div>
  </article>
</div>
${renderFooter()}
</body>
</html>`;
}

function renderHubPage(type, items, io) {
    const onlineCount = io ? io.engine.clientsCount : 42;
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
        title = "Global City Anonymous Chat Rooms | Connect Locally - ChatHere";
        meta = "Connect anonymously with locals and expats across 35+ major worldwide cities: New York, London, Tokyo, Berlin, Paris, Sydney, and more.";
        h1 = "Global City Chat Rooms";
        subhead = "Local discussions without neighborhood surveillance. Chat with residents and travelers across 35+ world metropolises.";
        cardsHtml = items.map(c => `
          <a href="/chat/city/${c.slug}" class="card" style="display:block;text-decoration:none">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:1.4rem">${c.flag}</span>
              <span style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase">${escHtml(c.timezone)}</span>
            </div>
            <h3 style="color:#fff;font-size:1.15rem;margin-bottom:4px">${escHtml(c.name)}</h3>
            <div style="color:var(--text-faint);font-size:0.8rem;margin-bottom:8px">${escHtml(c.country)}</div>
            <p style="color:var(--text-muted);font-size:0.85rem;line-height:1.4">${escHtml(c.popularLocalTopics[0])}</p>
          </a>
        `).join('');
    } else if (type === 'comparisons') {
        title = "ChatHere Platform Comparisons | Find the Best Chat Alternative";
        meta = "Compare ChatHere against Omegle, Discord, Chatroulette, Emerald Chat, Reddit, and 15+ stranger chat platforms in 2026.";
        h1 = "Platform Comparisons & Alternatives";
        subhead = "Objective, side-by-side feature breakdowns. Discover why privacy-first chatters choose ChatHere.";
        cardsHtml = items.map(c => `
          <a href="/vs/${c.slug}" class="card" style="display:block;text-decoration:none">
            <div style="font-size:0.75rem;text-transform:uppercase;color:var(--primary);font-weight:700;margin-bottom:6px">${escHtml(c.competitorCategory)}</div>
            <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px">ChatHere vs. ${escHtml(c.competitorName)}</h3>
            <p style="color:var(--text-muted);font-size:0.88rem;line-height:1.5">${escHtml(c.subheadline)}</p>
            <div style="margin-top:12px;font-size:0.8rem;color:var(--primary);font-weight:700">View Full Comparison &rarr;</div>
          </a>
        `).join('');
    } else if (type === 'use-cases') {
        title = "Anonymous Chat Use Cases & Guides | ChatHere";
        meta = "Explore how people use ChatHere for emotional venting, insomnia companionship, developer pair debugging, language practice, and more.";
        h1 = "Real-World Use Cases";
        subhead = "From 3:00 AM insomnia to anonymous coding help: discover how people use ChatHere's zero-log platform everyday.";
        cardsHtml = items.map(u => `
          <a href="/use-cases/${u.slug}" class="card" style="display:block;text-decoration:none">
            <div style="font-size:1.6rem;margin-bottom:8px">${u.icon}</div>
            <h3 style="color:#fff;font-size:1.15rem;margin-bottom:6px">${escHtml(u.name)}</h3>
            <p style="color:var(--text-muted);font-size:0.88rem;line-height:1.5">${escHtml(u.subheadline)}</p>
            <div style="margin-top:12px;font-size:0.8rem;color:var(--primary);font-weight:700">Read Practical Guide &rarr;</div>
          </a>
        `).join('');
    } else if (type === 'blog') {
        title = "ChatHere Blog | Privacy, Ephemeral Messaging & Community Insights";
        meta = "In-depth articles on digital privacy, anonymous chat resurgence, cybersecurity hygiene, and the death of invasive account signups.";
        h1 = "The ChatHere Blog";
        subhead = "Insights on privacy, digital disinhibition, software architecture, and the future of human conversation.";
        cardsHtml = items.map(b => `
          <article class="card" style="display:block;margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
              <span class="hero-badge" style="margin-bottom:0;font-size:0.7rem">${escHtml(b.category)}</span>
              <span style="color:var(--text-faint);font-size:0.8rem">${escHtml(b.date)}</span>
              <span style="color:var(--text-faint);font-size:0.8rem">&bull;</span>
              <span style="color:var(--text-faint);font-size:0.8rem">${escHtml(b.readTime)}</span>
            </div>
            <h2 style="font-size:1.35rem;font-weight:800;color:#fff;margin-bottom:10px">
              <a href="/blog/${b.slug}" style="color:#fff">${escHtml(b.title)}</a>
            </h2>
            <p style="color:var(--text-muted);font-size:0.95rem;line-height:1.6;margin-bottom:14px">${escHtml(b.excerpt)}</p>
            <a href="/blog/${b.slug}" style="font-weight:700;font-size:0.9rem">Read Article &rarr;</a>
          </article>
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
      ${onlineCount} users online now across ChatHere
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
