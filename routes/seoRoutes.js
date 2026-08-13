const express = require('express');
const router = express.Router();

// Topic Mapping to Query Parameters on Main Homepage
const TOPIC_ROOM_MAP = {
    'tech': 'Tech',
    'gaming': 'Gaming',
    'music': 'Music',
    'movies': 'Movies',
    'politics': 'Politics'
};

// Redirect any /chat/topic/:category to main page with ?room=...
router.get('/chat/topic/:category', (req, res) => {
    const cat = req.params.category.toLowerCase();
    const room = TOPIC_ROOM_MAP[cat] || 'General';
    res.redirect(301, '/?room=' + encodeURIComponent(room));
});

// Redirect any /chat/:country/:city to main page with ?room=General
router.get('/chat/:country/:city', (req, res) => {
    res.redirect(301, '/?room=General');
});

// Redirect any /vs/* to main page
router.get('/vs/:competitor', (req, res) => {
    res.redirect(301, '/?room=General');
});

// Dynamic XML Sitemap Generator (Listing main rooms and static pages for Sitelinks)
router.get('/sitemap.xml', (req, res) => {
    const baseUrl = 'https://chathere.online';
    const lastMod = new Date().toISOString().split('T')[0];

    const urls = [
        { loc: baseUrl + '/', priority: '1.0', changefreq: 'daily' },
        { loc: baseUrl + '/?room=General', priority: '0.9', changefreq: 'daily' },
        { loc: baseUrl + '/?room=Tech', priority: '0.9', changefreq: 'daily' },
        { loc: baseUrl + '/?room=Gaming', priority: '0.9', changefreq: 'daily' },
        { loc: baseUrl + '/?room=Music', priority: '0.9', changefreq: 'daily' },
        { loc: baseUrl + '/?room=Movies', priority: '0.9', changefreq: 'daily' },
        { loc: baseUrl + '/?room=Politics', priority: '0.9', changefreq: 'daily' },
        { loc: baseUrl + '/live', priority: '0.9', changefreq: 'always' },
        { loc: baseUrl + '/about.html', priority: '0.8', changefreq: 'monthly' }
    ];

    const xmlLines = urls.map(u => '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + lastMod + '</lastmod>\n    <changefreq>' + u.changefreq + '</changefreq>\n    <priority>' + u.priority + '</priority>\n  </url>').join('\n');

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + xmlLines + '\n</urlset>';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
});

// Dynamic RSS Feed
router.get('/rss.xml', (req, res) => {
    const io = req.app.get('io');
    const onlineCount = io ? io.engine.clientsCount : 0;
    const baseUrl = 'https://chathere.online';

    const xml = '<?xml version="1.0" encoding="UTF-8" ?>\n' +
'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
'<channel>\n' +
'  <title>ChatHere — Live Anonymous Chat</title>\n' +
'  <link>' + baseUrl + '</link>\n' +
'  <description>Real-time anonymous chat rooms with ' + onlineCount + ' people online now.</description>\n' +
'  <language>en-us</language>\n' +
'  <atom:link href="' + baseUrl + '/rss.xml" rel="self" type="application/rss+xml" />\n' +
'  <item>\n' +
'    <title>Live Chat Rooms — ' + onlineCount + ' Active Users Online</title>\n' +
'    <link>' + baseUrl + '/live</link>\n' +
'    <description>Join ongoing anonymous discussions across General, Tech, Gaming, Music, Movies, and Politics.</description>\n' +
'    <pubDate>' + new Date().toUTCString() + '</pubDate>\n' +
'    <guid>' + baseUrl + '/live</guid>\n' +
'  </item>\n' +
'</channel>\n' +
'</rss>';

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
});

module.exports = router;
