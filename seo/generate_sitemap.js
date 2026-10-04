const fs = require('fs');
const topics = require('../data/seoTopics');
const useCases = require('../data/seoUseCases');
const editorialBlogs = require('../data/seoEditorial');

const baseUrl = 'https://chathere.online';
const urls = [
    `${baseUrl}/`, `${baseUrl}/live`, `${baseUrl}/chat`, `${baseUrl}/use-cases`, `${baseUrl}/blog`,
    `${baseUrl}/about.html`, `${baseUrl}/marketing.html`
];

topics.forEach(t => urls.push(`${baseUrl}/chat/topic/${t.slug}`));
useCases.forEach(u => urls.push(`${baseUrl}/use-cases/${u.slug}`));
editorialBlogs.forEach(blog => urls.push(`${baseUrl}/blog/${blog.slug}`));

const xmlLines = urls.map(loc =>
    `  <url>\n    <loc>${loc}</loc>\n  </url>`
).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlLines}\n</urlset>`;

fs.writeFileSync('public/sitemap.xml', xml, 'utf8');
console.log(`Successfully wrote public/sitemap.xml with ${urls.length} URLs!`);
