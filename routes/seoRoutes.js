
const express = require('express');
const router = express.Router();

const topics = require('../data/seoTopics');
const cities = require('../data/seoCities');
const comparisons = require('../data/seoComparisons');
const useCases = require('../data/seoUseCases');
const blogs = require('../data/seoBlogs');

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
    res.send(renderHubPage('blog', blogs, io));
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
    const blog = blogs.find(b => b.slug === slug);
    if (!blog) {
        return sendNotFound(res);
    }
    if (rawSlug !== blog.slug) return res.redirect(301, `/blog/${blog.slug}`);
    const io = req.app.get('io');
    setCache(res, 300);
    res.send(renderBlogPage(blog, io));
});

// --- TECHNICAL SEO (SITEMAP & RSS) ---

// Dynamic XML Sitemap Generator (Listing all 117+ URLs with proper priorities)
router.get('/sitemap.xml', (req, res) => {
    const baseUrl = 'https://chathere.online';
    const lastMod = new Date().toISOString().split('T')[0];

    const urls = [
        { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
        { loc: `${baseUrl}/live`, priority: '0.9', changefreq: 'always' },
        { loc: `${baseUrl}/chat`, priority: '0.9', changefreq: 'daily' },
        { loc: `${baseUrl}/cities`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/vs`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/use-cases`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/blog`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/about.html`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/marketing.html`, priority: '0.8', changefreq: 'monthly' }
    ];

    // 30 Topics
    topics.forEach(t => {
        urls.push({ loc: `${baseUrl}/chat/topic/${t.slug}`, priority: '0.8', changefreq: 'daily' });
    });

    // 35 Cities
    cities.forEach(c => {
        urls.push({ loc: `${baseUrl}/chat/city/${c.slug}`, priority: '0.8', changefreq: 'weekly' });
    });

    // 20 Comparisons
    comparisons.forEach(cp => {
        urls.push({ loc: `${baseUrl}/vs/${cp.slug}`, priority: '0.8', changefreq: 'weekly' });
    });

    // 15 Use Cases
    useCases.forEach(u => {
        urls.push({ loc: `${baseUrl}/use-cases/${u.slug}`, priority: '0.8', changefreq: 'weekly' });
    });

    // 12 Blogs
    blogs.forEach(b => {
        urls.push({ loc: `${baseUrl}/blog/${b.slug}`, priority: '0.8', changefreq: 'weekly' });
    });

    const xmlLines = urls.map(u => 
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlLines}\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
});

// Dynamic RSS Feed
router.get('/rss.xml', (req, res) => {
    const io = req.app.get('io');
    const onlineCount = io ? io.engine.clientsCount : 42;
    const baseUrl = 'https://chathere.online';

    const blogItems = blogs.slice(0, 10).map(b => `
  <item>
    <title>${b.title.replace(/&/g, '&amp;')}</title>
    <link>${baseUrl}/blog/${b.slug}</link>
    <description>${b.excerpt.replace(/&/g, '&amp;')}</description>
    <pubDate>${new Date(b.date).toUTCString()}</pubDate>
    <guid>${baseUrl}/blog/${b.slug}</guid>
  </item>
    `).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>ChatHere — Live Anonymous Chat & Privacy Insights</title>
  <link>${baseUrl}</link>
  <description>Real-time anonymous chat rooms with ${onlineCount} people online. Zero login, zero logs.</description>
  <language>en-us</language>
  <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
  <item>
    <title>Live Chat Feed — ${onlineCount} Active Users Online</title>
    <link>${baseUrl}/live</link>
    <description>Join ongoing anonymous discussions across General, Tech, Gaming, Music, Movies, and Politics.</description>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <guid>${baseUrl}/live</guid>
  </item>
${blogItems}
</channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(xml);
});

module.exports = router;
