
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const COMMON_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d0d0f;
  --bg-card:rgba(255,255,255,0.035);
  --bg-card-hover:rgba(255,255,255,0.065);
  --border:rgba(255,255,255,0.08);
  --border-bright:rgba(255,255,255,0.16);
  --text:#e4e4e7;
  --text-muted:rgba(255,255,255,0.6);
  --text-faint:rgba(255,255,255,0.38);
  --primary:#5865f2;
  --primary-hover:#4752c4;
  --accent-purple:#7c3aed;
  --accent-green:#34d399;
  --accent-gold:#d4a127;
  --radius:12px;
}
body{
  font-family:Inter,system-ui,-apple-system,sans-serif;
  background:var(--bg);
  color:var(--text);
  line-height:1.65;
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
}
a{color:#a5b1fc;text-decoration:none;transition:color .2s}
a:hover{color:#c7d2fe;text-decoration:underline}
header{
  background:rgba(13,13,15,0.92);
  border-bottom:1px solid var(--border);
  padding:14px 24px;
  position:sticky;
  top:0;
  z-index:50;
  backdrop-filter:blur(14px);
  display:flex;
  align-items:center;
  gap:20px;
}
.brand{
  font-size:1.2rem;
  font-weight:800;
  color:#fff;
  letter-spacing:-.02em;
  display:flex;
  align-items:center;
  gap:8px;
}
.brand:hover{text-decoration:none}
.brand-badge{
  background:linear-gradient(135deg,var(--primary),var(--accent-purple));
  color:#fff;
  font-size:0.65rem;
  padding:2px 6px;
  border-radius:4px;
  font-weight:700;
  text-transform:uppercase;
}
nav{
  display:flex;
  align-items:center;
  gap:16px;
  margin-left:auto;
  font-size:0.9rem;
}
nav a{
  color:var(--text-muted);
  font-weight:600;
  padding:6px 10px;
  border-radius:6px;
}
nav a:hover{
  color:#fff;
  background:rgba(255,255,255,0.05);
  text-decoration:none;
}
.nav-live-pill{
  display:flex;
  align-items:center;
  gap:6px;
  background:rgba(52,211,153,0.12);
  border:1px solid rgba(52,211,153,0.3);
  color:var(--accent-green);
  padding:4px 12px;
  border-radius:20px;
  font-size:0.78rem;
  font-weight:700;
}
.nav-live-dot{
  width:7px;
  height:7px;
  background:var(--accent-green);
  border-radius:50%;
  animation:pulse 1.5s infinite;
}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.2)}}
.container{
  max-width:980px;
  margin:0 auto;
  padding:32px 20px 80px;
}
.breadcrumbs{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
  font-size:0.82rem;
  color:var(--text-faint);
  margin-bottom:24px;
}
.breadcrumbs a{color:var(--text-muted)}
.breadcrumbs span.sep{color:var(--text-faint)}
.hero{
  background:linear-gradient(180deg,rgba(88,101,242,0.08) 0%,rgba(13,13,15,0) 100%);
  border:1px solid var(--border);
  border-radius:20px;
  padding:48px 36px;
  text-align:center;
  margin-bottom:44px;
  position:relative;
  overflow:hidden;
}
.hero-badge{
  display:inline-flex;
  align-items:center;
  gap:6px;
  background:rgba(88,101,242,0.14);
  border:1px solid rgba(88,101,242,0.28);
  color:#a5b1fc;
  font-size:0.78rem;
  font-weight:700;
  text-transform:uppercase;
  padding:4px 12px;
  border-radius:20px;
  margin-bottom:16px;
  letter-spacing:0.04em;
}
.hero h1{
  font-size:2.4rem;
  font-weight:800;
  color:#fff;
  letter-spacing:-.03em;
  line-height:1.2;
  margin-bottom:16px;
}
.hero p.subhead{
  font-size:1.12rem;
  color:var(--text-muted);
  max-width:720px;
  margin:0 auto 28px;
}
.online-indicator{
  display:inline-flex;
  align-items:center;
  gap:8px;
  background:rgba(52,211,153,0.08);
  border:1px solid rgba(52,211,153,0.22);
  color:var(--accent-green);
  font-size:0.88rem;
  font-weight:600;
  padding:6px 16px;
  border-radius:30px;
  margin-bottom:28px;
}
.btn-cta-large{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  background:linear-gradient(135deg,var(--primary),var(--accent-purple));
  color:#fff;
  font-weight:700;
  font-size:1.05rem;
  padding:16px 36px;
  border-radius:12px;
  text-decoration:none;
  box-shadow:0 8px 24px rgba(88,101,242,0.35);
  transition:transform .15s,box-shadow .15s;
}
.btn-cta-large:hover{
  transform:translateY(-2px);
  box-shadow:0 12px 28px rgba(88,101,242,0.45);
  color:#fff;
  text-decoration:none;
}
.cta-subtext{
  margin-top:14px;
  font-size:0.8rem;
  color:var(--text-faint);
}
.section{margin-bottom:48px}
.section-header{
  margin-bottom:20px;
}
.section-tag{
  font-size:0.74rem;
  text-transform:uppercase;
  letter-spacing:0.06em;
  font-weight:700;
  color:var(--primary);
  margin-bottom:6px;
}
.section-title{
  font-size:1.55rem;
  font-weight:800;
  color:#fff;
  letter-spacing:-.02em;
}
.card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:24px;
  transition:border-color .2s,background .2s;
}
.card:hover{
  border-color:var(--border-bright);
  background:var(--bg-card-hover);
}
.grid-2{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
  gap:20px;
}
.grid-3{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:18px;
}
.feature-list{
  list-style:none;
  display:flex;
  flex-direction:column;
  gap:12px;
}
.feature-item{
  display:flex;
  align-items:flex-start;
  gap:10px;
  font-size:0.95rem;
  color:var(--text);
}
.feature-item .check{
  color:var(--accent-green);
  font-weight:bold;
  flex-shrink:0;
}
.prose{
  font-size:1.02rem;
  color:rgba(255,255,255,0.78);
  line-height:1.75;
}
.prose p{margin-bottom:16px}
.starter-bubble{
  background:rgba(255,255,255,0.03);
  border-left:3px solid var(--primary);
  padding:14px 18px;
  border-radius:0 10px 10px 0;
  font-style:italic;
  color:#d4d4d8;
  font-size:0.95rem;
  margin-bottom:12px;
}
.faq-box{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  overflow:hidden;
  margin-bottom:14px;
}
.faq-box summary{
  padding:18px 20px;
  font-weight:700;
  font-size:1.02rem;
  color:#fff;
  cursor:pointer;
  list-style:none;
  display:flex;
  justify-content:space-between;
  align-items:center;
}
.faq-box summary::-webkit-details-marker{display:none}
.faq-box summary::after{
  content:'+';
  font-size:1.4rem;
  color:var(--primary);
  transition:transform .2s;
}
.faq-box[open] summary::after{
  transform:rotate(45deg);
}
.faq-content{
  padding:0 20px 20px;
  color:var(--text-muted);
  font-size:0.95rem;
  line-height:1.6;
}
.table-wrap{
  overflow-x:auto;
  margin:20px 0 32px;
  border:1px solid var(--border);
  border-radius:var(--radius);
}
table.comp-table{
  width:100%;
  border-collapse:collapse;
  font-size:0.92rem;
  text-align:left;
}
table.comp-table th{
  background:rgba(255,255,255,0.06);
  color:#fff;
  font-weight:700;
  padding:14px 18px;
  border-bottom:1px solid var(--border);
}
table.comp-table td{
  padding:14px 18px;
  border-bottom:1px solid var(--border);
  color:var(--text);
}
.badge-check{
  display:inline-block;
  background:rgba(52,211,153,0.15);
  color:var(--accent-green);
  padding:3px 8px;
  border-radius:4px;
  font-weight:700;
  font-size:0.8rem;
}
.badge-cross{
  display:inline-block;
  background:rgba(239,68,68,0.15);
  color:#f87171;
  padding:3px 8px;
  border-radius:4px;
  font-weight:700;
  font-size:0.8rem;
}
.internal-links{
  background:rgba(255,255,255,0.02);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:24px;
  margin-top:40px;
}
.link-pills{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:12px;
}
.link-pill{
  background:rgba(255,255,255,0.04);
  border:1px solid var(--border);
  color:var(--text);
  padding:6px 14px;
  border-radius:20px;
  font-size:0.85rem;
  font-weight:600;
  transition:all .15s;
}
.link-pill:hover{
  background:rgba(88,101,242,0.15);
  border-color:rgba(88,101,242,0.4);
  color:#fff;
  text-decoration:none;
}
footer{
  border-top:1px solid var(--border);
  padding:40px 24px;
  text-align:center;
  color:var(--text-faint);
  font-size:0.85rem;
}
.footer-links{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:18px;
  margin-bottom:16px;
}
.footer-links a{color:var(--text-muted)}
.footer-links a:hover{color:#fff}
@media(max-width:768px){
  header{padding:12px 16px}
  nav{display:none}
  .hero{padding:32px 18px}
  .hero h1{font-size:1.85rem}
  .btn-cta-large{width:100%;padding:14px 20px}
  .grid-2{grid-template-columns:1fr}
}
`;

function renderHeader(onlineCount) {
    return `
<header>
  <a href="/" class="brand">
    <span>ChatHere</span>
    <span class="brand-badge">Official</span>
  </a>
  <nav>
    <a href="/live">Live Feed</a>
    <a href="/chat">Topics</a>
    <a href="/cities">Cities</a>
    <a href="/vs">Alternatives</a>
    <a href="/use-cases">Use Cases</a>
    <a href="/blog">Blog</a>
    <a href="/live" class="nav-live-pill">
      <span class="nav-live-dot"></span>
      ${onlineCount} Online
    </a>
  </nav>
</header>`;
}

function renderFooter() {
    return `
<footer>
  <div class="footer-links">
    <a href="/">Home</a>
    <a href="/live">Live Feed</a>
    <a href="/chat">Topics</a>
    <a href="/cities">Cities</a>
    <a href="/vs">Alternatives</a>
    <a href="/use-cases">Use Cases</a>
    <a href="/blog">Blog</a>
    <a href="/about.html">About</a>
    <a href="/marketing.html">Marketing</a>
    <a href="/sitemap.xml">Sitemap</a>
  </div>
  <p>&copy; 2026 ChatHere &mdash; Free, anonymous, 100% ephemeral real-time chat platform. Zero data collection, zero accounts, no logs.</p>
</footer>`;
}

module.exports = { escHtml, COMMON_CSS, renderHeader, renderFooter };
