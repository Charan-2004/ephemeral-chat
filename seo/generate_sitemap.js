const fs = require('fs');
const topics = require('../data/seoTopics');
const cities = require('../data/seoCities');
const comparisons = require('../data/seoComparisons');
const useCases = require('../data/seoUseCases');
const blogs = require('../data/seoBlogs');

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

topics.forEach(t => urls.push({ loc: `${baseUrl}/chat/topic/${t.slug}`, priority: '0.8', changefreq: 'daily' }));
cities.forEach(c => urls.push({ loc: `${baseUrl}/chat/city/${c.slug}`, priority: '0.8', changefreq: 'weekly' }));
comparisons.forEach(cp => urls.push({ loc: `${baseUrl}/vs/${cp.slug}`, priority: '0.8', changefreq: 'weekly' }));
useCases.forEach(u => urls.push({ loc: `${baseUrl}/use-cases/${u.slug}`, priority: '0.8', changefreq: 'weekly' }));
blogs.forEach(b => urls.push({ loc: `${baseUrl}/blog/${b.slug}`, priority: '0.8', changefreq: 'weekly' }));

const xmlLines = urls.map(u => 
    `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlLines}\n</urlset>`;

fs.writeFileSync('public/sitemap.xml', xml, 'utf8');
console.log(`Successfully wrote public/sitemap.xml with ${urls.length} URLs!`);
