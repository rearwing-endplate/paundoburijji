#!/usr/bin/env node
/**
 * Poundbridge build
 * -----------------
 * Run from the repo root:  node scripts/build.js
 *
 * Reads   dispatches/*.md  (Pages CMS front matter + markdown body)
 * Writes  articles.json    (same data your site already loads, plus `url` + `description`)
 *         d/<id>.html      (one static, pre-rendered page per dispatch, with Open Graph
 *                           + Twitter Card tags baked in so link previews work)
 *         og/*.jpg         (1200x630, <300 KB share images generated from your plates)
 *
 * Why static pages? WhatsApp, X/Twitter, Telegram, iMessage etc. fetch the raw HTML and
 * do NOT run JavaScript. dispatch.html?id=... is filled in by JS, so every crawler sees
 * the same empty shell. Each dispatch needs its own real HTML file with its own <meta> tags.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const { marked } = require('marked');
const cheerio = require('cheerio');
const sharp = require('sharp');

// ───────────────────────── config ─────────────────────────
const ROOT = process.cwd();
const SITE_NAME = 'Poundbridge';
const DEFAULT_PLATE = 'ustreasury.jpg';   // used when a dispatch has no bgImage
const HOME_PLATE = 'ustreasury.jpg';      // plate used for og/site.jpg (your index.html preview)
const IMAGE_DIRS = ['.', 'assets'];       // where plate images may live (repo root, then /assets)
const OG_W = 1200;
const OG_H = 630;
const OG_MAX_BYTES = 280 * 1024;          // WhatsApp drops preview images over ~300 KB

const SRC_DIR = path.join(ROOT, 'dispatches');
const PAGES_DIR = path.join(ROOT, 'd');
const OG_DIR = path.join(ROOT, 'og');
const TEMPLATE = path.join(ROOT, 'dispatch.html');

// ───────────────────────── helpers ─────────────────────────
function resolveSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');

  const cname = path.join(ROOT, 'CNAME');            // GitHub Pages custom domain
  if (fs.existsSync(cname)) {
    const host = fs.readFileSync(cname, 'utf8').trim();
    if (host) return 'https://' + host;
  }

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
  if (!owner || !repo) {
    throw new Error('Cannot work out the site URL. Set the SITE_URL environment variable, e.g. https://poundbridge.com');
  }
  const o = owner.toLowerCase();
  return repo.toLowerCase() === `${o}.github.io` ? `https://${o}.github.io` : `https://${o}.github.io/${repo}`;
}

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'dispatch';

function findPlate(name) {
  for (const dir of IMAGE_DIRS) {
    const abs = path.join(ROOT, dir, name);
    if (fs.existsSync(abs)) return { abs, rel: path.posix.join(dir === '.' ? '' : dir, name) };
  }
  return null;
}

function excerpt(html, max = 180) {
  const text = cheerio.load(html).root().text().replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

// ─────────────────── share-image generation ───────────────────
const usedOg = new Set();
const ogCache = new Map();

async function renderOg(buf, quality) {
  return sharp(buf)
    .rotate()
    .resize(OG_W, OG_H, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#0a0a0e' })     // PNG transparency -> dark, not black/white fringe
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/** Hash-named so a changed plate gets a NEW url (scrapers cache images by url). */
async function ogImageFor(plateAbs) {
  if (ogCache.has(plateAbs)) return ogCache.get(plateAbs);

  const buf = fs.readFileSync(plateAbs);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const stem = slugify(path.basename(plateAbs, path.extname(plateAbs)));
  const file = `${stem}-${hash}.jpg`;
  const out = path.join(OG_DIR, file);

  if (!fs.existsSync(out)) {
    let q = 82;
    let data = await renderOg(buf, q);
    while (data.length > OG_MAX_BYTES && q > 50) {
      q -= 8;
      data = await renderOg(buf, q);
    }
    fs.writeFileSync(out, data);
    console.log(`  og/${file}  ${(data.length / 1024).toFixed(0)} KB (q${q})`);
  }
  usedOg.add(file);
  ogCache.set(plateAbs, file);
  return file;
}

// ───────────────────── page generation ─────────────────────
function buildPage(template, a, { siteUrl, ogFile, heroSrc }) {
  const $ = cheerio.load(template);
  const pageUrl = `${siteUrl}/${a.url}`;
  const ogUrl = ogFile ? `${siteUrl}/og/${ogFile}` : null;
  const alt = `Visual plate for “${a.title}”`;
  const fullTitle = `${a.title} — ${SITE_NAME}`;

  // Pages live in /d/, so let every relative link in the template (styles.css, index.html,
  // favicon.svg, plate images...) resolve against the site root instead.
  $('head').prepend('<base href="../">');

  $('title').text(fullTitle);

  const add = (tag, attrs) => $('head').append($(`<${tag}>`).attr(attrs)).append('\n');
  add('meta', { name: 'description', content: a.description });
  add('link', { rel: 'canonical', href: pageUrl });

  add('meta', { property: 'og:type', content: 'article' });
  add('meta', { property: 'og:site_name', content: SITE_NAME });
  add('meta', { property: 'og:title', content: a.title });
  add('meta', { property: 'og:description', content: a.description });
  add('meta', { property: 'og:url', content: pageUrl });
  if (a.date) add('meta', { property: 'article:published_time', content: a.date });
  if (ogUrl) {
    add('meta', { property: 'og:image', content: ogUrl });
    add('meta', { property: 'og:image:type', content: 'image/jpeg' });
    add('meta', { property: 'og:image:width', content: String(OG_W) });
    add('meta', { property: 'og:image:height', content: String(OG_H) });
    add('meta', { property: 'og:image:alt', content: alt });
  }

  add('meta', { name: 'twitter:card', content: ogUrl ? 'summary_large_image' : 'summary' });
  add('meta', { name: 'twitter:title', content: a.title });
  add('meta', { name: 'twitter:description', content: a.description });
  if (ogUrl) {
    add('meta', { name: 'twitter:image', content: ogUrl });
    add('meta', { name: 'twitter:image:alt', content: alt });
  }

  if (heroSrc) add('link', { rel: 'preload', as: 'image', href: heroSrc });

  // Pre-render exactly what dispatch.html's JavaScript would have injected.
  $('#dispatchMeta').text(`[ INCITE // ${a.category.toUpperCase()} ]`);
  $('#dispatchTitle').text(a.title);
  $('#dispatchBody').html(a.content);
  if (heroSrc) $('#dispatchHeroBanner').css('background-image', `url('${heroSrc}')`);

  // Tells dispatch.html's loader script not to overwrite the pre-rendered content.
  $('body').attr('data-prerendered', 'true');

  return $.html();
}

// ─────────────────────────── main ───────────────────────────
async function main() {
  const siteUrl = resolveSiteUrl();
  console.log(`Site URL: ${siteUrl}`);

  if (!fs.existsSync(TEMPLATE)) throw new Error('dispatch.html not found in repo root.');
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  if (!template.includes('data-prerendered')) {
    throw new Error(
      'dispatch.html is missing the pre-render guard. Add this as the first line inside its ' +
      "DOMContentLoaded handler:  if (document.body.hasAttribute('data-prerendered')) return;"
    );
  }

  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.mkdirSync(OG_DIR, { recursive: true });
  fs.rmSync(PAGES_DIR, { recursive: true, force: true });   // drop pages of deleted dispatches
  fs.mkdirSync(PAGES_DIR, { recursive: true });

  const files = fs.readdirSync(SRC_DIR).filter((f) => /\.(md|markdown)$/i.test(f));
  const articles = [];
  const slugs = new Set();

  for (const file of files) {
    const parsed = matter(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'));

    const id = String(parsed.data.id || path.basename(file, path.extname(file)));
    const title = parsed.data.title || 'Untitled';

    // Publication date from CMS front matter: the single source of truth for ordering.
    let date = null;
    if (parsed.data.date) {
      const d = new Date(parsed.data.date);
      if (isNaN(d.getTime())) console.warn(`  ! ${file}: unreadable date "${parsed.data.date}"`);
      else date = d.toISOString();
    }

    // Category is inferred from the plate, exactly as before.
    const bgImage = parsed.data.bgImage || DEFAULT_PLATE;
    const category = bgImage === 'ustreasury.jpg' ? 'salisminster' : 'burj';

    const content = marked.parse(parsed.content, { breaks: true });
    const description = String(parsed.data.description || excerpt(content));

    let slug = slugify(id);
    for (let n = 2; slugs.has(slug); n++) slug = `${slugify(id)}-${n}`;
    slugs.add(slug);

    articles.push({ id, title, category, bgImage, date, description, url: `d/${slug}.html`, content });
  }

  articles.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));

  // Share images + static pages
  console.log('Share images:');
  for (const a of articles) {
    let plate = findPlate(a.bgImage);
    if (!plate) {
      console.warn(`  ! ${a.id}: plate "${a.bgImage}" not found, falling back to ${DEFAULT_PLATE}`);
      plate = findPlate(DEFAULT_PLATE);
    }
    const ogFile = plate ? await ogImageFor(plate.abs) : null;
    const heroSrc = plate ? encodeURI(plate.rel) : null;

    fs.writeFileSync(path.join(ROOT, a.url), buildPage(template, a, { siteUrl, ogFile, heroSrc }));
  }

  // Stable-name share image for index.html (hard-coded there, so no hash in the name).
  const home = findPlate(HOME_PLATE);
  if (home) {
    fs.writeFileSync(path.join(OG_DIR, 'site.jpg'), await renderOg(fs.readFileSync(home.abs), 80));
    usedOg.add('site.jpg');
  }

  // Remove share images no longer referenced.
  for (const f of fs.readdirSync(OG_DIR)) {
    if (!usedOg.has(f)) fs.unlinkSync(path.join(OG_DIR, f));
  }

  fs.writeFileSync(path.join(ROOT, 'articles.json'), JSON.stringify(articles, null, 2));
  console.log(`Done: articles.json + ${articles.length} static page(s) in d/ + share images in og/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
