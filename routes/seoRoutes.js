
const express = require('express');
const router = express.Router();

const topics = require('../data/seoTopics');
const cities = require('../data/seoCities');
const comparisons = require('../data/seoComparisons');
const useCases = require('../data/seoUseCases');
const legacyBlogs = require('../data/seoBlogs');
const editorialBlogs = require('../data/seoEditorial');

const {
    renderTopicPage,
    renderCityPage,
    renderComparisonPage,
    renderUseCasePage,
    renderBlogPage,
    renderHubPage
} = require('../seo/seoTemplate');

function sendNotFound(res) {
    res.status(404).setHeader('X-Robots-Tag', 'noindex');
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | ChatHere</title><meta name="robots" content="noindex,follow"></head><body><main><h1>Page not found</h1><p>This ChatHere page does not exist.</p><p><a href="/">Go to ChatHere</a> or <a href="/chat">browse chat topics</a>.</p></main></body></html>`);
}

// Normalize slash variants before routing so each page has one URL and a one-hop redirect.
router.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && req.path.length > 1 && /\/$/.test(req.path)) {
        const query = req.originalUrl.slice(req.path.length);
        return res.redirect(301, `${req.path.replace(/\/+$/, '')}${query}`);
    }
    next();
});

// Keep the old static blog URL as a single-hop alias to the canonical hub.
router.get('/blog.html', (req, res) => res.redirect(301, '/blog'));

// Caching helper
function setCache(res, maxAgeSeconds = 300) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}, stale-while-revalidate=60`);
}

// --- HUB DIRECTORIES ---

// /chat - Topics Hub
router.get('/chat', (req, res) => {
    const io = req.app.get('io');
    setCache(res, 300);
    res.send(renderHubPage('topics', topics, io));
});

// /cities - Cities Hub
router.get('/cities', (req, res) => {
    const io = req.app.get('io');
    setCache(res, 600);
    res.send(renderHubPage('cities', cities, io));
});

// /vs - Competitor Comparisons Hub
router.get('/vs', (req, res) => {
    const io = req.app.get('io');
    setCache(res, 600);
    res.send(renderHubPage('comparisons', comparisons, io));
});

// /use-cases - Use Cases Hub
router.get('/use-cases', (req, res) => {
    const io = req.app.get('io');
    setCache(res, 600);
    res.send(renderHubPage('use-cases', useCases, io));
});

// /blog & /blog.html - Blog Hub
router.get('/blog', (req, res) => {
    const io = req.app.get('io');
    setCache(res, 300);
    res.send(renderHubPage('blog', editorialBlogs, io));
});

// --- PROGRAMMATIC DETAIL PAGES ---

// /chat/topic/:slug
router.get('/chat/topic/:slug', (req, res) => {
    const slug = (req.params.slug || '').toLowerCase().trim();
    const topic = topics.find(t => t.slug === slug);
    if (!topic) {
        return sendNotFound(res);
    }
    if (req.params.slug !== topic.slug) return res.redirect(301, `/chat/topic/${topic.slug}`);
    const io = req.app.get('io');
    setCache(res, 180);
    res.send(renderTopicPage(topic, io));
});

// /chat/city/:slug
router.get('/chat/city/:slug', (req, res) => {
    const slug = (req.params.slug || '').toLowerCase().trim();
    const city = cities.find(c => c.slug === slug);
    if (!city) {
        return sendNotFound(res);
    }
    if (req.params.slug !== city.slug) return res.redirect(301, `/chat/city/${city.slug}`);
    const io = req.app.get('io');
    setCache(res, 300);
    res.send(renderCityPage(city, io));
});

// Legacy /chat/:country/:city redirect/renderer
router.get('/chat/:country/:city', (req, res) => {
    const citySlug = (req.params.city || '').toLowerCase().trim();
    const matchedCity = cities.find(c => c.slug === citySlug || c.slug === citySlug.replace(/\s+/g, '-'));
    if (matchedCity) {
        return res.redirect(301, `/chat/city/${matchedCity.slug}`);
    }
    sendNotFound(res);
});

// /vs/:slug
router.get('/vs/:slug', (req, res) => {
    const slug = (req.params.slug || '').toLowerCase().trim();
    const comp = comparisons.find(c => c.slug === slug);
    if (!comp) {
        return sendNotFound(res);
    }
    if (req.params.slug !== comp.slug) return res.redirect(301, `/vs/${comp.slug}`);
    const io = req.app.get('io');
    setCache(res, 300);
    res.send(renderComparisonPage(comp, io));
});

// /use-cases/:slug
router.get('/use-cases/:slug', (req, res) => {
    const slug = (req.params.slug || '').toLowerCase().trim();
    const uc = useCases.find(u => u.slug === slug);
    if (!uc) {
        return sendNotFound(res);
    }
    if (req.params.slug !== uc.slug) return res.redirect(301, `/use-cases/${uc.slug}`);
    const io = req.app.get('io');
    setCache(res, 300);
    res.send(renderUseCasePage(uc, io));
});

// /blog/:slug
router.get('/blog/:slug', (req, res) => {
    const rawSlug = (req.params.slug || '').trim();
    const slug = rawSlug.toLowerCase().replace(/\.html$/, '');
    const blog = editorialBlogs.find(b => b.slug === slug) || legacyBlogs.find(b => b.slug === slug);
    if (!blog) {
        return sendNotFound(res);
    }
    if (rawSlug !== blog.slug) return res.redirect(301, `/blog/${blog.slug}`);
    const io = req.app.get('io');
    setCache(res, 300);
    res.send(renderBlogPage({ ...blog, editoriallyReviewed: editorialBlogs.some(item => item.slug === slug) }, io));
});

// --- TECHNICAL SEO (SITEMAP & RSS) ---

// Dynamic XML sitemap containing canonical public pages.
router.get('/sitemap.xml', (req, res) => {
    const baseUrl = 'https://chathere.online';
    const urls = [
        `${baseUrl}/`, `${baseUrl}/live`, `${baseUrl}/chat`, `${baseUrl}/use-cases`, `${baseUrl}/blog`,
        `${baseUrl}/about.html`, `${baseUrl}/marketing.html`
    ];

    // 30 Topics
    topics.forEach(t => {
        urls.push(`${baseUrl}/chat/topic/${t.slug}`);
    });

    // 15 Use Cases
    useCases.filter(u => !u.editorialHold).forEach(u => {
        urls.push(`${baseUrl}/use-cases/${u.slug}`);
    });
    editorialBlogs.forEach(blog => urls.push(`${baseUrl}/blog/${blog.slug}`));

    const xmlLines = urls.map(loc =>
        `  <url>\n    <loc>${loc}</loc>\n  </url>`
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlLines}\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
});

// Dynamic RSS Feed
router.get('/rss.xml', (req, res) => {
    const baseUrl = 'https://chathere.online';
    const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const items = editorialBlogs.map(blog => `<item><title>${escapeXml(blog.title)}</title><link>${baseUrl}/blog/${blog.slug}</link><guid>${baseUrl}/blog/${blog.slug}</guid><description>${escapeXml(blog.metaDescription)}</description><pubDate>${new Date(`${blog.date}T00:00:00Z`).toUTCString()}</pubDate></item>`).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>ChatHere Guides</title>
  <link>${baseUrl}/blog</link>
  <description>Source-linked guides about online privacy, chat safety, messaging, and chat technology.</description>
  <language>en-us</language>
  <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(xml);
});

module.exports = router;
