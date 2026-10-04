const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const seoRoutes = require('../routes/seoRoutes');
const { createLivePage } = require('../routes/liveRoute');
const topics = require('../data/seoTopics');
const cities = require('../data/seoCities');
const comparisons = require('../data/seoComparisons');
const useCases = require('../data/seoUseCases');
const blogs = require('../data/seoBlogs');

const collections = [
    { items: topics, path: item => `/chat/topic/${item.slug}`, type: 'topic', relatedKey: 'relatedSlugs' },
    { items: cities, path: item => `/chat/city/${item.slug}`, type: 'city', relatedKey: 'relatedCities' },
    { items: comparisons, path: item => `/vs/${item.slug}`, type: 'comparison', relatedKey: 'relatedComparisons' },
    { items: useCases, path: item => `/use-cases/${item.slug}`, type: 'use case', relatedKey: 'relatedSlugs' },
    { items: blogs, path: item => `/blog/${item.slug}`, type: 'blog', relatedKey: 'relatedBlogs' }
];
const hubs = [
    ['/chat', 'topics'], ['/cities', 'cities'], ['/vs', 'comparisons'],
    ['/use-cases', 'use-cases'], ['/blog', 'blog']
];

function metaContent(html, name) {
    const tag = html.match(new RegExp(`<meta\\b(?=[^>]*\\bname=["']${name}["'])[^>]*>`, 'i'))?.[0];
    return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
}

function canonicalUrl(html) {
    return html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']*)["'][^>]*>/i)?.[1] || '';
}

function jsonLd(html) {
    return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
        .map(([, body]) => JSON.parse(body));
}

function walkSchema(value, type, found = []) {
    if (Array.isArray(value)) value.forEach(item => walkSchema(item, type, found));
    else if (value && typeof value === 'object') {
        if (value['@type'] === type) found.push(value);
        Object.values(value).forEach(item => walkSchema(item, type, found));
    }
    return found;
}

function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function inspectHtml(html, url, { detail = false, expectedH1, requireBreadcrumb = false } = {}) {
    assert.match(html, /<title\b[^>]*>\s*[^<]+\s*<\/title>/i, `${url}: missing title`);
    assert.ok(metaContent(html, 'description').trim(), `${url}: missing meta description`);
    assert.equal(canonicalUrl(html), `https://chathere.online${url}`, `${url}: canonical does not match route`);
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    assert.equal(h1Count, 1, `${url}: expected exactly one H1, found ${h1Count}`);
    if (expectedH1) assert.match(html, new RegExp(`<h1\\b[^>]*>[\\s\\S]*?${expectedH1}[\\s\\S]*?<\\/h1>`, 'i'), `${url}: missing page heading`);

    const schemas = jsonLd(html);
    if (requireBreadcrumb) assert.ok(walkSchema(schemas, 'BreadcrumbList').length, `${url}: missing breadcrumb schema`);
    if (detail) {
        const faq = walkSchema(schemas, 'FAQPage')[0];
        assert.ok(faq, `${url}: missing FAQ schema`);
        const visibleFaqCount = (html.match(/<details\b[^>]*class=["']faq-box["']/gi) || []).length;
        assert.equal(faq.mainEntity.length, visibleFaqCount, `${url}: FAQ schema does not match visible FAQ content`);
        for (const entry of faq.mainEntity) {
            assert.ok(html.includes(escapeHtml(entry.name)), `${url}: FAQ schema question is missing from the page`);
            assert.ok(html.includes(escapeHtml(entry.acceptedAnswer.text)), `${url}: FAQ schema answer is missing from the page`);
        }
    }
    return schemas;
}

async function main() {
    const staticPages = [
        ['index.html', '/'], ['about.html', '/about.html'], ['marketing.html', '/marketing.html'],
        ['links.html', '/links.html'], ['blog.html', '/blog']
    ];
    for (const [file, url] of staticPages) {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
        inspectHtml(html, url, { requireBreadcrumb: url === '/about.html' || url === '/marketing.html' });
        for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
            const imageTag = match[0];
            assert.match(imageTag, /\balt=["'][^"']*["']/i, `${file}: image missing alt text`);
            assert.match(imageTag, /\bwidth=["']?\d+/i, `${file}: image missing width`);
            assert.match(imageTag, /\bheight=["']?\d+/i, `${file}: image missing height`);
        }
    }
    for (const file of ['admin/index.html', 'previews/index.html']) {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
        assert.match(html, /<meta\b(?=[^>]*\bname=["']robots["'])[^>]*\bcontent=["'][^"']*noindex/i, `${file}: expected noindex`);
    }
    const robots = fs.readFileSync(path.join(__dirname, '..', 'public', 'robots.txt'), 'utf8');
    const googlebotRule = robots.match(/User-agent:\s*Googlebot\s*([\s\S]*?)(?=\nUser-agent:|$)/i)?.[1] || '';
    assert.match(googlebotRule, /Allow:\s*\//i, 'robots.txt: Googlebot must be explicitly allowed');

    const app = express();
    app.use('/', seoRoutes);
    app.get('/live', createLivePage);
    app.use(express.static(path.join(__dirname, '..', 'public')));
    const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    let checked = 0;
    const hubHtml = new Map();
    try {
        for (const [path, type] of hubs) {
            const response = await fetch(`${base}${path}`);
            assert.equal(response.status, 200, `${path}: expected 200`);
            const html = await response.text();
            hubHtml.set(path, html);
            inspectHtml(html, path, { requireBreadcrumb: true });
            assert.equal(new URL(canonicalUrl(html)).pathname, path, `${path}: malformed hub canonical`);
            const ogUrl = html.match(/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*\bcontent=["']([^"']*)["'][^>]*>/i)?.[1];
            assert.equal(ogUrl, `https://chathere.online${path}`, `${path}: Open Graph URL mismatch`);
            checked++;
        }

        for (const group of collections) {
            const slugs = new Set(group.items.map(item => item.slug));
            const directoryPath = group.type === 'topic' ? '/chat' :
                group.type === 'city' ? '/cities' :
                group.type === 'comparison' ? '/vs' :
                group.type === 'use case' ? '/use-cases' : '/blog';
            const directoryHtml = hubHtml.get(directoryPath);
            for (const item of group.items) {
                assert.ok(item.title?.trim(), `${group.type} ${item.slug}: missing title data`);
                assert.ok(item.metaDescription?.trim(), `${group.type} ${item.slug}: missing description data`);
                for (const slug of item[group.relatedKey] || []) {
                    const relatedExists = group.items === useCases
                        ? useCases.some(entry => entry.slug === slug) || topics.some(entry => entry.slug === slug)
                        : slugs.has(slug);
                    assert.ok(relatedExists, `${item.slug}: related ${group.type} ${slug} does not exist`);
                }

                const path = group.path(item);
                assert.ok(directoryHtml.includes(`href="${path}"`), `${path}: not linked from its directory hub`);
                const response = await fetch(`${base}${path}`);
                assert.equal(response.status, 200, `${path}: expected 200`);
                const html = await response.text();
                const schemas = inspectHtml(html, path, { detail: true, requireBreadcrumb: true });
                assert.equal(new URL(canonicalUrl(html)).pathname, path, `${path}: malformed canonical`);
                if (group.type === 'blog') {
                    assert.ok(walkSchema(schemas, 'Article').length, `${path}: missing Article schema`);
                    assert.match(html, /href=["']\/about\.html#editorial-team["']/, `${path}: author bio link missing`);
                }
                if (group.relatedKey) {
                    const hrefPrefix = group.type === 'topic' ? '/chat/topic/' :
                        group.type === 'city' ? '/chat/city/' :
                        group.type === 'comparison' ? '/vs/' :
                        group.type === 'use case' ? null : '/blog/';
                    const relatedHrefPattern = group.type === 'use case'
                        ? /href=["'](\/use-cases|\/chat\/topic)\/([^"'#?]+)["']/g
                        : new RegExp(`href=["']${hrefPrefix}([^"'#?]+)["']`, 'g');
                    const linkedSlugs = [...html.matchAll(relatedHrefPattern)];
                    for (const match of linkedSlugs) {
                        const slug = group.type === 'use case' ? match[2] : match[1];
                        const linkedExists = group.items === useCases
                            ? useCases.some(entry => entry.slug === slug) || topics.some(entry => entry.slug === slug)
                            : slugs.has(slug);
                        assert.ok(linkedExists, `${path}: broken related link to ${slug}`);
                    }
                }
                checked++;
            }
        }

        const sitemapResponse = await fetch(`${base}/sitemap.xml`);
        assert.equal(sitemapResponse.status, 200, 'sitemap: expected 200');
        const sitemap = await sitemapResponse.text();
        const liveResponse = await fetch(`${base}/live`);
        assert.equal(liveResponse.status, 200, '/live: expected 200');
        inspectHtml(await liveResponse.text(), '/live', { requireBreadcrumb: true });
        checked++;
        const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        assert.ok(sitemapUrls.length, 'sitemap: no URLs found');
        assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'sitemap: duplicate URLs found');
        const expectedUrls = new Set([
            'https://chathere.online/', 'https://chathere.online/live',
            'https://chathere.online/about.html', 'https://chathere.online/marketing.html',
            ...hubs.map(([path]) => `https://chathere.online${path}`),
            ...collections.flatMap(group => group.items.map(item => `https://chathere.online${group.path(item)}`))
        ]);
        for (const url of expectedUrls) assert.ok(sitemapUrls.includes(url), `sitemap: missing ${url}`);
        for (const url of sitemapUrls) assert.ok(expectedUrls.has(url), `sitemap: unexpected/non-canonical URL ${url}`);
        const staticSitemap = fs.readFileSync(path.join(__dirname, '..', 'public', 'sitemap.xml'), 'utf8');
        const staticSitemapUrls = [...staticSitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        assert.deepEqual(new Set(staticSitemapUrls), new Set(sitemapUrls), 'static and live sitemap URLs differ');
        for (const url of sitemapUrls) {
            const page = await fetch(`${base}${new URL(url).pathname}`);
            assert.equal(page.status, 200, `sitemap URL ${url} does not return 200`);
        }

        for (const asset of ['/logo.webp', '/bg.webp']) {
            const response = await fetch(`${base}${asset}`);
            assert.equal(response.status, 200, `${asset}: image not found`);
            assert.match(response.headers.get('content-type') || '', /^image\/webp/i, `${asset}: incorrect image MIME type`);
        }

        const legacy = await fetch(`${base}/blog.html`, { redirect: 'manual' });
        assert.equal(legacy.status, 301, '/blog.html should permanently redirect');
        assert.equal(legacy.headers.get('location'), '/blog', '/blog.html should redirect directly to /blog');
        const legacyArticle = await fetch(`${base}/blog/${blogs[0].slug}.html`, { redirect: 'manual' });
        assert.equal(legacyArticle.status, 301, 'legacy .html article path should permanently redirect');
        assert.equal(legacyArticle.headers.get('location'), `/blog/${blogs[0].slug}`, 'legacy article path should redirect directly to canonical URL');
        const legacyCity = await fetch(`${base}/chat/united-kingdom/london`, { redirect: 'manual' });
        assert.equal(legacyCity.status, 301, 'legacy city path should permanently redirect');
        assert.equal(legacyCity.headers.get('location'), '/chat/city/london', 'legacy city path should redirect directly to canonical route');
        for (const [path] of hubs.slice(0, 1)) {
            const trailingSlash = await fetch(`${base}${path}/`, { redirect: 'manual' });
            assert.equal(trailingSlash.status, 301, `${path}/ should redirect permanently`);
            assert.equal(trailingSlash.headers.get('location'), path, `${path}/ should redirect directly to canonical route`);
        }
        for (const path of ['/chat/topic/not-a-real-topic', '/chat/city/not-a-real-city', '/vs/not-a-real-comparison', '/use-cases/not-a-real-case', '/blog/not-a-real-article']) {
            const missing = await fetch(`${base}${path}`, { redirect: 'manual' });
            assert.equal(missing.status, 404, `${path}: unknown content should return 404`);
            assert.match(missing.headers.get('x-robots-tag') || '', /noindex/i, `${path}: missing noindex header`);
        }

        const uppercase = await fetch(`${base}/chat/topic/TECH`, { redirect: 'manual' });
        assert.equal(uppercase.status, 301, 'case-variant URLs should permanently redirect');
        assert.equal(uppercase.headers.get('location'), '/chat/topic/tech', 'case-variant redirect should point to canonical URL');

        console.log(`SEO verification passed for ${checked} rendered pages and ${sitemapUrls.length} sitemap URLs.`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
