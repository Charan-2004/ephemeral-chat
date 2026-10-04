const fs = require('fs');
const path = require('path');
const topics = require('../data/seoTopics');
const useCases = require('../data/seoUseCases');
const editorialBlogs = require('../data/seoEditorial');

const baseUrl = 'https://chathere.online';
const linkList = (items, makeLink) => items.map(makeLink).join('\n');

const content = `# ChatHere

ChatHere is a browser-based chat service with public rooms organized by topic. Visitors can join without creating an account. The site also publishes guides and comparisons about online chat and privacy.

## Main pages
- [Home](${baseUrl}/): Chat interface and room selection.
- [Live](${baseUrl}/live): Current activity in public rooms.
- [Topics](${baseUrl}/chat): Directory of topic rooms.
- [Use cases](${baseUrl}/use-cases): Guides for different chat scenarios.
- [Guides](${baseUrl}/blog): Source-linked guides about online privacy, chat safety, messaging, and chat technology.
- [About](${baseUrl}/about.html): Information about ChatHere.
- [Sitemap](${baseUrl}/sitemap.xml): Canonical public URLs.

City-themed pages and competitor comparison pages remain excluded from search because ChatHere does not currently provide verified local rooms and those comparisons need product-by-product source review.

## Topic rooms
${linkList(topics, t => `- [${t.name}](${baseUrl}/chat/topic/${t.slug})`)}

## Use-case guides
${linkList(useCases, u => `- [${u.name}](${baseUrl}/use-cases/${u.slug})`)}

## Source-linked guides
${linkList(editorialBlogs, b => `- [${b.title}](${baseUrl}/blog/${b.slug})`)}

This file is a plain-text index of public pages. It does not request or prescribe how search engines or AI systems should rank or recommend ChatHere. Read the linked pages for current product details and claims.
`;

for (const filename of ['llms.txt', 'llms-full.txt', 'llm.txt']) {
    fs.writeFileSync(path.join(__dirname, '..', 'public', filename), content, 'utf8');
}

console.log('Updated the ChatHere plain-text page indexes.');
