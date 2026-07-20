/* =========================================================================
   extract.js — Import automat din URL (Task 19). Crawler same-origin + extractor
   determinist, FĂRĂ AI. Prioritate: date structurate (JSON-LD/microdata/OG) →
   linkuri semantice (tel:/mailto:) → euristici de text cu validare strictă.

   Folosește doar `fetch` nativ (Node 22+) și parsing propriu — zero dependențe.
   Nu salvează automat: întoarce câmpuri pre-completate + scor de încredere + sursă.
   ========================================================================= */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DB = require('./db');

const UA = 'ReformasMadridBot/1.0 (+import automat; sin IA)';
const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const SCHEMA_DAY = {
  monday: 'lunes', tuesday: 'martes', wednesday: 'miercoles', thursday: 'jueves',
  friday: 'viernes', saturday: 'sabado', sunday: 'domingo',
};

/* Sinónimos de servicios de contractores → slug de categoría (best-effort;
   el admin confirma/ajusta al guardar). Los slugs deben coincidir con las
   categorías sembradas en la BD (seed.js). */
const SERVICE_SYNONYMS = [
  // Fontaneros
  ['fontaner', 'fontaneros'], ['desatasc', 'desatascos'], ['fuga de agua', 'fugas-de-agua'], ['fugas de agua', 'fugas-de-agua'],
  ['calentador', 'calderas'], ['caldera', 'calderas'],
  // Electricistas
  ['electricist', 'electricistas'], ['electricidad', 'electricistas'], ['instalacion electrica', 'instalaciones-electricas'],
  ['boletin electrico', 'boletin-electrico'], ['averia electrica', 'averias-electricas'], ['iluminacion', 'iluminacion'],
  // Climatización
  ['aire acondicionado', 'aire-acondicionado'], ['climatizacion', 'climatizacion'], ['calefaccion', 'calefaccion'],
  ['bomba de calor', 'bombas-de-calor'], ['aerotermia', 'bombas-de-calor'],
  // Cerrajeros
  ['cerrajer', 'cerrajeros'], ['apertura de puerta', 'apertura-puertas'], ['cambio de cerradura', 'cambio-cerraduras'],
  ['bombin', 'cambio-cerraduras'], ['puerta acorazada', 'puertas-acorazadas'],
  // Reformas
  ['reforma integral', 'reformas-integrales'], ['reforma de bano', 'reformas-banos'], ['reforma de cocina', 'reformas-cocinas'],
  ['reforma de local', 'reformas-locales'], ['reforma', 'reformas'], ['albanil', 'reformas'],
];

/* --------------------------- Helpers text/HTML ------------------------ */
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCP(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCP(parseInt(d, 10)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ');
}
function safeCP(n) { try { return String.fromCodePoint(n); } catch { return ''; } }

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

// Parsează atributele unui singur tag (ex. "<meta property=... content=...>")
function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  return attrs;
}

/* ------------------------------- Fetch -------------------------------- */
async function fetchPage(url, { timeoutMs = 12000, maxBytes = 2 * 1024 * 1024 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    });
    const ct = r.headers.get('content-type') || '';
    const finalUrl = r.url || url;
    if (!r.ok) return { ok: false, status: r.status, contentType: ct, finalUrl };
    if (!/text\/html|application\/xhtml/i.test(ct)) return { ok: false, status: r.status, contentType: ct, finalUrl, skipped: 'no-html' };
    // Citim limitat (protecție împotriva paginilor enorme)
    const reader = r.body.getReader();
    const chunks = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      chunks.push(value);
      if (total > maxBytes) { try { ctrl.abort(); } catch {} break; }
    }
    const html = Buffer.concat(chunks).toString('utf8');
    return { ok: true, status: r.status, contentType: ct, finalUrl, html };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : (e.message || 'fetch-error') };
  } finally { clearTimeout(timer); }
}

async function fetchBinary(url, { timeoutMs = 12000, maxBytes = 3 * 1024 * 1024 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > maxBytes || buf.length === 0) return null;
    return { buf, contentType: ct };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

/* ------------------------------ robots.txt ---------------------------- */
async function loadRobots(origin) {
  const rules = { disallow: [], allow: [] };
  try {
    const r = await fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!r.ok) return rules;
    const text = (await r.text()).slice(0, 100000);
    let applies = false;
    text.split(/\r?\n/).forEach(raw => {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) return;
      const idx = line.indexOf(':');
      if (idx < 0) return;
      const field = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (field === 'user-agent') applies = (val === '*' || norm(val).includes('reformasmadrid'));
      else if (applies && field === 'disallow' && val) rules.disallow.push(val);
      else if (applies && field === 'allow' && val) rules.allow.push(val);
    });
  } catch { /* fără robots → permitem tot */ }
  return rules;
}
function robotsAllows(rules, pathname) {
  const longest = arr => arr.filter(p => pathname.startsWith(p)).reduce((a, b) => (b.length > a.length ? b : a), '');
  const d = longest(rules.disallow), a = longest(rules.allow);
  if (!d) return true;
  return a.length >= d.length;   // Allow mai specific (sau egal) câștigă
}

/* ---------------------- Prioritizare URL utile ------------------------ */
const USEFUL_KW = ['contacto', 'contact', 'donde-estamos', 'donde', 'localizacion', 'ubicacion',
  'servicios', 'services', 'presupuesto', 'especialidades', 'horario', 'horarios',
  'sobre', 'quienes', 'nosotros', 'about', 'empresa', 'reformas'];
function urlScore(u, anchorText) {
  const s = norm(u.pathname + ' ' + (anchorText || ''));
  let score = 0;
  USEFUL_KW.forEach(kw => { if (s.includes(kw)) score += 3; });
  const depth = u.pathname.split('/').filter(Boolean).length;
  score -= depth;                        // preferăm pagini mai apropiate de rădăcină
  if (u.pathname === '/' || u.pathname === '') score += 2;
  return score;
}

function extractLinks(html, base) {
  const out = [];
  const re = /<a\b[^>]*?href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let u;
    try { u = new URL(href, base); } catch { continue; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    u.hash = '';
    out.push({ url: u, anchor: stripTags(m[5]).slice(0, 80) });
  }
  return out;
}

/* ===================== Extractoare per pagină ========================= */
function collectJsonLd(html) {
  const nodes = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const push = obj => { if (obj && typeof obj === 'object') nodes.push(obj); };
    const walk = d => {
      if (Array.isArray(d)) d.forEach(walk);
      else if (d && typeof d === 'object') {
        if (d['@graph']) walk(d['@graph']);
        push(d);
      }
    };
    walk(data);
  }
  return nodes;
}

const BIZ_TYPES = ['localbusiness', 'organization', 'homeandconstructionbusiness', 'generalcontractor', 'plumber', 'electrician', 'locksmith', 'hvacbusiness', 'roofingcontractor', 'professionalservice'];
function typeOf(node) {
  const t = node['@type'];
  const arr = Array.isArray(t) ? t : [t];
  return arr.map(x => norm(x).replace(/^https?:\/\/schema\.org\//, ''));
}
function isBiz(node) { return typeOf(node).some(t => BIZ_TYPES.includes(t)); }

function fromJsonLd(nodes, out, meta, src) {
  // preferăm un nod „business"; altfel Organization/oricare cu date utile
  const biz = nodes.find(isBiz) || nodes.find(n => n.name || n.telephone || n.address);
  if (!biz) return;
  const set = (field, val, conf) => {
    if (val == null || val === '' || out[field] != null && out[field] !== '' && meta[field] && meta[field].rank >= conf.rank) return;
    out[field] = val; meta[field] = { confidence: conf.label, rank: conf.rank, source: src, via: 'JSON-LD' };
  };
  const HIGH = { label: 'alta', rank: 3 };

  if (biz.name) set('name', String(biz.name).trim(), HIGH);
  if (biz.telephone) set('phone', normalizePhone(String(biz.telephone)), HIGH);
  if (biz.email) set('email', String(biz.email).replace(/^mailto:/i, '').trim(), HIGH);
  if (biz.description) set('about', clip(String(biz.description).trim(), 600), HIGH);

  // adresă
  const addr = biz.address;
  if (addr) {
    if (typeof addr === 'string') set('address', addr.trim(), HIGH);
    else if (typeof addr === 'object') {
      const a = Array.isArray(addr) ? addr[0] : addr;
      const parts = [a.streetAddress, a.postalCode, a.addressLocality].filter(Boolean).map(x => String(x).trim());
      if (parts.length) set('address', parts.join(', '), HIGH);
      if (a.addressLocality) meta._locality = String(a.addressLocality).trim();
    }
  }
  // logo
  const logo = biz.logo || (biz.image && (Array.isArray(biz.image) ? biz.image[0] : biz.image));
  const logoUrl = typeof logo === 'object' ? (logo.url || logo.contentUrl) : logo;
  if (logoUrl) set('logo', String(logoUrl), HIGH);

  // orar
  if (biz.openingHoursSpecification) {
    const hours = parseOpeningSpec(biz.openingHoursSpecification);
    if (hours && Object.keys(hours).length) set('hours', hours, HIGH);
  } else if (biz.openingHours) {
    const hours = parseOpeningHoursText(biz.openingHours);
    if (hours && Object.keys(hours).length) set('hours', hours, { label: 'media', rank: 2 });
  }
  // rețele sociale (sameAs)
  if (biz.sameAs) {
    const arr = Array.isArray(biz.sameAs) ? biz.sameAs : [biz.sameAs];
    const social = out.social || {};
    arr.forEach(u => { const k = socialKey(u); if (k && !social[k]) social[k] = String(u); });
    if (Object.keys(social).length) { out.social = social; meta.social = { confidence: 'alta', rank: 3, source: src, via: 'JSON-LD sameAs' }; }
  }
  // valorare
  const agg = biz.aggregateRating;
  if (agg && typeof agg === 'object') {
    const rv = Number(agg.ratingValue), rc = parseInt(agg.reviewCount || agg.ratingCount, 10);
    if (!isNaN(rv)) { out.rating = Math.min(5, Math.max(0, rv)); meta.rating = { confidence: 'alta', rank: 3, source: src, via: 'JSON-LD' }; }
    if (!isNaN(rc)) { out.reviews = rc; meta.reviews = { confidence: 'alta', rank: 3, source: src, via: 'JSON-LD' }; }
  }
}

function parseOpeningSpec(spec) {
  const list = Array.isArray(spec) ? spec : [spec];
  const hours = {};
  list.forEach(s => {
    if (!s || typeof s !== 'object') return;
    const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek];
    const opens = tidyTime(s.opens), closes = tidyTime(s.closes);
    if (!opens || !closes) return;
    days.forEach(d => {
      const key = SCHEMA_DAY[norm(String(d)).replace(/^https?:\/\/schema\.org\//, '')];
      if (!key) return;
      const slot = `${opens} – ${closes}`;
      hours[key] = hours[key] ? hours[key] + ' / ' + slot : slot;
    });
  });
  return hours;
}
function parseOpeningHoursText(txt) {
  // ex. "Mo-Fr 09:00-18:00" — suport minimal
  const arr = Array.isArray(txt) ? txt : [txt];
  const MAP = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
  const hours = {};
  arr.forEach(line => {
    const m = /([A-Za-z]{2})\s*-?\s*([A-Za-z]{2})?\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(String(line));
    if (!m) return;
    const a = MAP[m[1].toLowerCase()], b = m[2] ? MAP[m[2].toLowerCase()] : a;
    if (a == null || b == null) return;
    for (let i = a; i <= b; i++) hours[DAYS[i]] = `${m[3]} – ${m[4]}`;
  });
  return hours;
}
function tidyTime(t) {
  if (!t) return '';
  const m = /(\d{1,2}):(\d{2})/.exec(String(t));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

function fromMeta(html, out, meta, src) {
  const tags = {};
  const re = /<meta\b[^>]*>/gi; let m;
  while ((m = re.exec(html))) {
    const a = parseAttrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null) tags[key] = a.content;
  }
  const MED = { label: 'media', rank: 2 };
  const setIf = (field, val, conf) => {
    if (!val) return;
    if (out[field] != null && out[field] !== '' && meta[field] && meta[field].rank >= conf.rank) return;
    out[field] = val; meta[field] = { confidence: conf.label, rank: conf.rank, source: src, via: 'meta/OG' };
  };
  if (tags['og:site_name']) setIf('name', tags['og:site_name'].trim(), MED);
  else if (tags['og:title']) setIf('name', cleanTitle(tags['og:title']), MED);
  const desc = tags['og:description'] || tags['description'];
  if (desc) setIf('about', clip(desc.trim(), 600), MED);
  if (tags['og:image']) setIf('logo', tags['og:image'], { label: 'baja', rank: 1 });
}

function fromSemanticLinks(html, out, meta, src) {
  const HIGH = { label: 'alta', rank: 3 };
  let m;
  const tel = /href\s*=\s*["']tel:([^"']+)["']/i.exec(html);
  if (tel) setField(out, meta, 'phone', normalizePhone(tel[1]), HIGH, src, 'tel:');
  const mail = /href\s*=\s*["']mailto:([^"'?]+)/i.exec(html);
  if (mail) {
    const email = decodeEntities(mail[1]).trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setField(out, meta, 'email', email, HIGH, src, 'mailto:');
  }
  // logo din <link rel=icon / apple-touch-icon> și <img ... logo>
  if (!out.logo || (meta.logo && meta.logo.rank < 2)) {
    const linkRe = /<link\b[^>]*>/gi;
    let best = null;
    while ((m = linkRe.exec(html))) {
      const a = parseAttrs(m[0]);
      const rel = (a.rel || '').toLowerCase();
      if (/apple-touch-icon|icon/.test(rel) && a.href) { if (rel.includes('apple-touch-icon') || !best) best = a.href; }
    }
    if (!best) {
      const imgRe = /<img\b[^>]*>/gi;
      while ((m = imgRe.exec(html))) {
        const a = parseAttrs(m[0]);
        const hint = norm((a.alt || '') + ' ' + (a.class || '') + ' ' + (a.id || '') + ' ' + (a.src || ''));
        if (hint.includes('logo') && a.src) { best = a.src; break; }
      }
    }
    if (best) setField(out, meta, 'logo', best, { label: 'media', rank: 2 }, src, 'link/img logo');
  }
}

function fromHeuristics(html, out, meta, src) {
  const text = stripTags(html);
  const nt = norm(text);
  // telefon ES (doar dacă lipsește)
  if (!out.phone) {
    const pm = /(?:\+34|0034)?[\s.\-]?(?:[6789]\d[\s.\-]?)(?:\d[\s.\-]?){7}\d/.exec(text);
    if (pm) { const p = normalizePhone(pm[0]); if (p) setField(out, meta, 'phone', p, { label: 'baja', rank: 1 }, src, 'regex texto'); }
  }
  if (!out.email) {
    const em = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i.exec(text);
    if (em) setField(out, meta, 'email', em[0].toLowerCase(), { label: 'baja', rank: 1 }, src, 'regex texto');
  }
  // adresă: stradă + cod poștal 28xxx
  if (!out.address) {
    const am = /((?:calle|c\/|avenida|avda|av\.|paseo|plaza|pza|glorieta|ronda|camino)\b[^,.\n]{2,60},?\s*(?:\d{1,3}[^,.\n]{0,20})?,?\s*280\d{2}\s*madrid)/i.exec(text);
    if (am) setField(out, meta, 'address', am[1].replace(/\s+/g, ' ').trim(), { label: 'baja', rank: 1 }, src, 'regex texto');
    else { const cp = /\b(280\d{2})\b/.exec(text); if (cp) meta._cp = cp[1]; }
  }
  // categorías reconocidas (headings + listas + texto) → slugs
  const cands = [];
  let m;
  const hRe = /<(h[1-3]|li|option)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  while ((m = hRe.exec(html))) { const t = stripTags(m[2]); if (t && t.length <= 60) cands.push(norm(t)); }
  const pool = cands.join(' | ') + ' | ' + nt.slice(0, 4000);
  const found = new Set(out.categorySlugs || []);
  SERVICE_SYNONYMS.forEach(([kw, slug]) => { if (pool.includes(kw)) found.add(slug); });
  if (found.size) {
    out.categorySlugs = [...found];
    if (!meta.services || meta.services.rank < 1) meta.services = { confidence: 'media', rank: 1, source: src, via: 'texto/lista' };
  }
  // descriere fallback din primul paragraf relevant
  if (!out.about) {
    const pm = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let p;
    while ((p = pm.exec(html))) { const t = stripTags(p[1]); if (t.length >= 60) { setField(out, meta, 'about', clip(t, 500), { label: 'baja', rank: 1 }, src, 'primer párrafo'); break; } }
  }
}

/* --------------------------- Normalizări ------------------------------ */
function setField(out, meta, field, val, conf, src, via) {
  if (val == null || val === '') return;
  if (out[field] != null && out[field] !== '' && meta[field] && meta[field].rank >= conf.rank) return;
  out[field] = val;
  meta[field] = { confidence: conf.label, rank: conf.rank, source: src, via };
}
function normalizePhone(raw) {
  let d = String(raw).replace(/[^\d+]/g, '');
  d = d.replace(/^0034/, '+34').replace(/^\+340+/, '+34');
  const digits = d.replace(/\D/g, '');
  let nat = digits;
  if (d.startsWith('+34')) nat = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('34')) nat = digits.slice(2);
  if (nat.length !== 9 || !/^[6789]/.test(nat)) return '';   // validare strictă ES
  return '+34 ' + nat.slice(0, 3) + ' ' + nat.slice(3, 6) + ' ' + nat.slice(6);
}
function socialKey(url) {
  const u = norm(url);
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('linkedin.com')) return 'linkedin';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return null;
}
function cleanTitle(t) {
  return String(t).split(/[|·—–\-]/)[0].trim().slice(0, 80) || String(t).trim();
}
function clip(s, n) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }

function detectZone(out, meta) {
  // Detectăm distrito/barrio din taxonomia reală (BD). Barrio în adresă (fuerte);
  // altfel distrito în adresă (fuerte) sau descripción (débil). Admin confirmă.
  const strong = norm([out.address, meta._locality].filter(Boolean).join(' '));
  const soft = norm(out.about || '');
  const districts = DB.listDistricts();
  const allBarrios = [];
  districts.forEach(d => DB.listNeighborhoods(d.id).forEach(b => allBarrios.push({ b, d })));
  allBarrios.sort((x, y) => y.b.name.length - x.b.name.length);
  const districtsByLen = [...districts].sort((a, b) => b.name.length - a.name.length);

  let zoneName = null, via = 'dirección', conf = 'media';
  const barrioHit = allBarrios.find(({ b }) => b.name.length >= 4 && strong.includes(norm(b.name)));
  if (barrioHit) {
    out.districtSlug = barrioHit.d.slug; out.barrioSlug = barrioHit.b.slug;
    zoneName = barrioHit.b.name + ' · ' + barrioHit.d.name;
  } else {
    let dHit = districtsByLen.find(d => strong.includes(norm(d.name)));
    if (!dHit) { dHit = districtsByLen.find(d => soft.includes(norm(d.name))); via = 'descripción'; conf = 'baja'; }
    if (dHit) { out.districtSlug = dHit.slug; zoneName = dHit.name; }
  }
  if (zoneName) { out.zone = zoneName; meta.zone = { confidence: conf, rank: 1, source: via, via: 'zona Madrid' }; }
}

/* =========================== Orchestrare ============================== */
async function extractFromUrl(rawUrl, opts = {}) {
  const maxPages = Math.min(opts.maxPages || 25, 30);
  const concurrency = opts.concurrency || 3;
  const perPageDelay = opts.delayMs != null ? opts.delayMs : 250;

  let start;
  try { start = new URL(rawUrl); } catch { const e = new Error('URL no válida'); e.code = 'BAD_URL'; throw e; }
  if (start.protocol !== 'http:' && start.protocol !== 'https:') { const e = new Error('Solo se admiten URLs http(s)'); e.code = 'BAD_URL'; throw e; }

  const origin = start.origin;
  const robots = await loadRobots(origin);

  const out = {};                 // câmpuri extrase
  const meta = {};                // { field: { confidence, rank, source, via } }
  const notes = [];
  const visited = new Set();
  const crawled = [];

  // coadă de URL-uri cu scor
  const queue = [{ url: start, anchor: '' }];
  const enqueued = new Set([start.href]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function processOne(item) {
    const href = item.url.href;
    if (visited.has(href) || visited.size >= maxPages) return;
    if (!robotsAllows(robots, item.url.pathname)) { notes.push(`robots.txt bloquea ${item.url.pathname}`); return; }
    visited.add(href);
    const res = await fetchPage(href, { timeoutMs: opts.timeoutMs || 12000 });
    if (!res.ok || !res.html) { if (res.error) notes.push(`${item.url.pathname}: ${res.error}`); return; }
    crawled.push(item.url.pathname || '/');
    const src = res.finalUrl || href;

    // extracție în ordinea priorității (funcțiile respectă rangul deja setat)
    const jsonld = collectJsonLd(res.html);
    if (jsonld.length) fromJsonLd(jsonld, out, meta, src);
    fromSemanticLinks(res.html, out, meta, src);
    fromMeta(res.html, out, meta, src);
    fromHeuristics(res.html, out, meta, src);

    // descoperă linkuri noi (same-origin), prioritizează utile
    if (visited.size < maxPages) {
      extractLinks(res.html, src).forEach(l => {
        if (l.url.origin !== origin) return;
        if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|doc|docx|mp4|mp3|css|js)$/i.test(l.url.pathname)) return;
        if (enqueued.has(l.url.href)) return;
        enqueued.add(l.url.href);
        queue.push(l);
      });
    }
  }

  while (queue.length && visited.size < maxPages) {
    queue.sort((a, b) => urlScore(b.url, b.anchor) - urlScore(a.url, a.anchor));
    const batch = queue.splice(0, concurrency);
    await Promise.all(batch.map(processOne));
    if (perPageDelay) await sleep(perPageDelay);
  }

  detectZone(out, meta);

  // descarcă logo → uploads/ (disc) sau inline (data URL, pe serverless)
  if (out.logo && (opts.uploadsDir || opts.inline)) {
    try {
      const abs = new URL(out.logo, origin).href;
      const bin = await fetchBinary(abs);
      const ext = bin && imageExt(bin.contentType, abs);
      if (bin && ext) {
        if (opts.inline) {
          // Serverless: fără disc → stocăm imaginea inline (persistă în DB).
          out.photo = 'data:' + (bin.contentType || 'image/' + ext) + ';base64,' + bin.buf.toString('base64');
        } else {
          const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
          fs.writeFileSync(path.join(opts.uploadsDir, name), bin.buf);
          out.photo = '/uploads/' + name;
        }
        meta.photo = meta.logo;
      } else notes.push('No se pudo descargar el logo (formato/tamaño).');
    } catch { notes.push('No se pudo descargar el logo.'); }
  }

  // website = originea site-ului (canonic)
  out.website = origin;
  meta.website = { confidence: 'alta', rank: 3, source: origin, via: 'URL' };

  // curăță câmpurile interne + construiește payload public
  const fields = {
    name: out.name || '', zone: out.zone || '',
    districtSlug: out.districtSlug || null, barrioSlug: out.barrioSlug || null,
    address: out.address || '', about: out.about || '',
    categorySlugs: out.categorySlugs || [],
    phone: out.phone || '', email: out.email || '', website: out.website || '',
    social: out.social || {}, hours: normalizeHours(out.hours),
    photo: out.photo || null, logoUrl: out.logo || null,
    rating: out.rating != null ? out.rating : null, reviews: out.reviews != null ? out.reviews : null,
  };
  const confidence = {};
  Object.keys(meta).forEach(k => { if (k[0] !== '_') confidence[k] = { level: meta[k].confidence, source: meta[k].source, via: meta[k].via }; });

  return { fields, confidence, pagesCrawled: crawled.length, pages: crawled, notes };
}

function normalizeHours(h) {
  const out = {};
  DAYS.forEach(d => { out[d] = (h && h[d]) || 'Cerrado'; });
  return out;
}
function imageExt(ct, url) {
  ct = (ct || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('svg')) return 'svg';
  const m = /\.(png|jpe?g|webp|gif|svg)(?:$|\?)/i.exec(url || '');
  if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  return null;
}

module.exports = { extractFromUrl };
