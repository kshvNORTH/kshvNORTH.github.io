// Northbound static site builder. No dependencies.
// Usage: node build.mjs        (SITE_URL=https://yourdomain.com node build.mjs for production)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
// [your site URL] placeholder: set SITE_URL at build time once the domain is known.
const SITE_URL = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');

// Deployment-time settings. Anything unset is simply left out of the page (no visible placeholders).
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || '';
const LINKEDIN_URL = process.env.LINKEDIN_URL || '';
const FORM_ENDPOINT = process.env.FORM_ENDPOINT || '';
const CAL_URL = process.env.CAL_URL || 'https://calendly.com/mitushi-006/30min';

const DESCRIPTION =
  'Northbound Consultancy is a founder-led content and thought leadership agency for B2B founders and expert-led firms.';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- structured data ----------
const schemas = {
  organization: () => ({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Northbound Consultancy',
    description: DESCRIPTION,
    url: SITE_URL,
    ...(LINKEDIN_URL ? { sameAs: [LINKEDIN_URL] } : {}),
    founder: [
      { '@type': 'Person', name: 'Mitushi' },
      { '@type': 'Person', name: 'Monica' },
    ],
  }),
  faq: (meta, body) => {
    const items = [...body.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>\s*<div class="faq-a">([\s\S]*?)<\/div>\s*<\/details>/g)];
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((m) => ({
        '@type': 'Question',
        name: text(m[1]),
        acceptedAnswer: { '@type': 'Answer', text: text(m[2]) },
      })),
    };
  },
  article: (meta) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.headline || meta.title,
    description: meta.description,
    author: { '@type': 'Organization', name: 'Northbound Consultancy', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Northbound Consultancy', url: SITE_URL },
    mainEntityOfPage: SITE_URL + meta.path,
  }),
};

const jsonLd = (meta, body) =>
  (meta.schema || [])
    .filter((n) => schemas[n])
    .map((n) => `<script type="application/ld+json">${JSON.stringify(schemas[n](meta, body))}</script>`)
    .join('\n');

// ---------- templates ----------
const read = (p) => readFileSync(join(SRC, p), 'utf8');
const logo = read('partials/logo.html');
const header = read('partials/header.html').replace('{{logo}}', logo);
const footer = read('partials/footer.html').replace('{{logo}}', logo);
const cta = read('partials/cta.html');
const layout = read('layout.html');
const hasPage = (n) => readdirSync(join(SRC, 'pages')).includes(n + '.html');
const hasLegal = hasPage('privacy') && hasPage('terms');
const fill = (html) =>
  html
    .replaceAll('{{legal_col}}', hasLegal
      ? '<nav aria-label="Legal"><h2 class="footer-h">Legal</h2><ul><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Terms</a></li></ul></nav>'
      : '')
    .replaceAll('{{privacy_link}}', hasPage('privacy') ? ' See our <a href="/privacy">Privacy policy</a>.' : '')
    .replaceAll('{{email_link}}', CONTACT_EMAIL ? ` · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>` : '')
    .replaceAll('{{linkedin_link}}', LINKEDIN_URL ? ` · <a href="${LINKEDIN_URL}" rel="noopener">LinkedIn</a>` : '')
    .replaceAll('{{form_action}}', FORM_ENDPOINT)
    .replaceAll('{{cal_step}}', '')
    .replaceAll('{{cal_block}}', CAL_URL
      ? `<div class="card form-card cal-embed"><div class="calendly-inline-widget" data-url="${CAL_URL}?hide_gdpr_banner=1" style="min-width:320px;height:760px"></div><p class="cal-fallback">Calendar not loading? <a href="${CAL_URL}" target="_blank" rel="noopener">Open the booking page</a>.</p></div>`
      : '');


const withCurrent = (html, path) =>
  html.replace(/<a ([^>]*?)data-nav="([^"]+)"([^>]*)>/g, (m, a, p, b) =>
    path === p || path.startsWith(p + '/') ? `<a ${a}${b} aria-current="page">` : `<a ${a}${b}>`
  );

// ---------- build ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });

const built = [];
for (const file of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html')).sort()) {
  const raw = read(`pages/${file}`);
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--meta {...}--> block`);
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length).replace('{{cta}}', cta);
  const canonical = SITE_URL + (meta.path === '/' ? '/' : meta.path);

  let html = layout
    .replaceAll('{{title}}', esc(meta.title))
    .replaceAll('{{description}}', esc(meta.description))
    .replaceAll('{{canonical}}', canonical)
    .replaceAll('{{siteUrl}}', SITE_URL)
    .replaceAll('{{ogType}}', meta.ogType || 'website')
    .replace('{{robots}}', meta.noindex ? '<meta name="robots" content="noindex">' : '')
    .replace('{{jsonld}}', jsonLd(meta, body))
    .replace('{{header}}', withCurrent(header, meta.path))
    .replace('{{footer}}', footer)
    .replace('{{body}}', body);
  html = fill(html);
  if (CAL_URL) html = html.replace(/<!--native-->[\s\S]*?<!--\/native-->/, '');

  if (meta.path.endsWith('.html')) {
    writeFileSync(join(DIST, meta.path.slice(1)), html);
  } else {
    const outDir = meta.path === '/' ? DIST : join(DIST, meta.path);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html);
  }
  built.push({ path: meta.path, noindex: !!meta.noindex, modified: meta.modified || meta.published });
}

// sitemap + robots (only indexable pages that exist)
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    built
      .filter((p) => !p.noindex)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((p) => `  <url><loc>${SITE_URL}${p.path}</loc></url>`)
      .join('\n') +
    `\n</urlset>\n`
);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

if (!FORM_ENDPOINT) console.warn('WARNING: FORM_ENDPOINT is not set: the contact form cannot deliver submissions yet.');
if (!CONTACT_EMAIL) console.warn('NOTE: CONTACT_EMAIL not set: no email shown in footer.');
if (!hasLegal) console.warn('WARNING: no privacy/terms pages: legal links are hidden. Required before launch.');
console.log(`Built ${built.length} page(s): ${built.map((p) => p.path).join(', ')}  →  dist/  (SITE_URL=${SITE_URL})`);
