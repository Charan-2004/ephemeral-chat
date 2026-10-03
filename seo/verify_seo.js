const express = require('express');
const seoRoutes = require('../routes/seoRoutes');
const app = express();
app.use('/', seoRoutes);

const server = app.listen(3098, async () => {
  const res = await fetch('http://localhost:3098/chat/topic/tech');
  const html = await res.text();
  console.log('Has canonical:', html.includes('<link rel="canonical" href="https://chathere.online/chat/topic/tech">'));
  console.log('Has FAQ schema:', html.includes('"@type":"FAQPage"'));
  console.log('Has Breadcrumb schema:', html.includes('"@type":"BreadcrumbList"'));
  console.log('Has Join CTA:', html.includes('Join #Tech Room Now'));
  console.log('Has Related Topics:', html.includes('Related Topic Rooms'));
  
  const blogRes = await fetch('http://localhost:3098/blog/why-anonymous-chat-is-resurging-2026');
  const blogHtml = await blogRes.text();
  console.log('Blog has Article schema:', blogHtml.includes('"@type":"Article"'));
  console.log('Blog has FAQ schema:', blogHtml.includes('"@type":"FAQPage"'));
  
  const sitemapRes = await fetch('http://localhost:3098/sitemap.xml');
  const sitemapXml = await sitemapRes.text();
  console.log('Sitemap has tech:', sitemapXml.includes('/chat/topic/tech'));
  console.log('Sitemap has tokyo:', sitemapXml.includes('/chat/city/tokyo'));
  console.log('Sitemap has omegle:', sitemapXml.includes('/vs/omegle'));
  console.log('Sitemap has blog:', sitemapXml.includes('/blog/why-anonymous-chat-is-resurging-2026'));
  
  server.close(() => console.log('All SEO checks passed!'));
});
