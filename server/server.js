/* =========================================================================
   server.js — Express: servește paginile SEO (SSR) + frontend-ul (public/)
   + API REST. Auth reală (cookie-session), upload poze pe disc, analytics.
   Rulează: npm start  →  http://localhost:3000
   ========================================================================= */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const cookieSession = require('cookie-session');

/* ------------------------- Încărcare .env (manual) --------------------- */
(function loadEnv(file) {
  try {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch { /* fără .env → folosim valori implicite */ }
})(path.join(__dirname, '..', '.env'));

const DB = require('./db');
const { seedIfEmpty, ensureCategories, ensureMunicipios, DEMO_BUSINESSES } = require('./seed');
const { extractFromUrl } = require('./extract');
const R = require('./render');

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

/* Pe serverless (Vercel) discul e read-only și efemer → nu scriem fișiere:
   imaginile se stochează inline (data URL) în DB, care persistă în Postgres. */
const SERVERLESS = !!process.env.VERCEL;
if (!SERVERLESS) { try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* ignoră */ } }

/* Slug-uri rezervate care NU pot fi categorii (ar intra în conflict cu rutele). */
const RESERVED_SLUGS = new Set([
  'api', 'uploads', 'assets', 'admin', 'login', 'admin.html', 'login.html', 'index.html',
  'negocio', 'zona', 'zonas', 'metro', 'buscar', 'sitemap.xml', 'robots.txt', 'favicon.ico',
  'aviso-legal', 'privacidad', 'cookies', 'condiciones',
]);
function isReservedSlug(s) { return RESERVED_SLUGS.has(String(s || '').toLowerCase()); }

/* --------------------- Bootstrap: Supabase + seed --------------------- */
/* Rulează O DATĂ înainte de a servi cereri:
   1) hidratează SQLite-ul in-memory din Postgres (dacă e configurat);
   2) seed dacă e gol (Postgres gol sau fără Supabase);
   3) dacă tocmai am făcut seed într-un Postgres gol → îl salvăm în Postgres. */
const ready = (async () => {
  let hydrated = 0;
  try {
    hydrated = await DB.initPersistence();
  } catch (e) {
    console.error('⚠️  Nu m-am putut conecta la Postgres (Supabase):', e.message);
  }
  seedIfEmpty();
  // Migrări idempotente: adaugă categoriile + cele 178 de municipios pe DB deja
  // populate (disc/Supabase), unde seedIfEmpty nu mai intră.
  const catsChanged = ensureCategories();
  const munisChanged = ensureMunicipios();
  if (DB.persistenceEnabled() && (hydrated === 0 || catsChanged > 0 || munisChanged > 0)) {
    try { await DB.persist(); }
    catch (e) { console.error('⚠️  Nu am putut salva seed-ul în Postgres:', e.message); }
  }
})();

/* Salvează în Postgres după o scriere de admin, apoi răspunde. */
async function saveAndRespond(res, payload, status) {
  try { await DB.persist(); }
  catch (e) { console.error('persist error:', e); return res.status(500).json({ error: 'No se pudo guardar en la base de datos' }); }
  return res.status(status || 200).json(payload);
}

/* ------------------------------ App ----------------------------------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use(cookieSession({
  name: 'rm_sess',
  secret: SESSION_SECRET,
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
}));

/* Așteaptă bootstrap-ul (hidratare Postgres + seed) înainte de orice cerere. */
app.use((req, res, next) => { ready.then(() => next()).catch(next); });

/* Fișiere statice (index:false → „/" e servit de SSR, nu de index.html). */
if (!SERVERLESS) app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(express.static(PUBLIC_DIR, { index: false }));

/* ------------------------------ Helpers ------------------------------- */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'No autorizado' });
}
const ok = (res, data) => res.json(data);
function ctx(req) { return { origin: req.protocol + '://' + req.get('host'), path: req.path }; }
function sendHtml(res, html, status) { res.status(status || 200).type('html').send(html); }

/* =============================== API =================================== */
/* ------------------------------- Auth --------------------------------- */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const good = safeEqual(username || '', ADMIN_USERNAME) && safeEqual(password || '', ADMIN_PASSWORD);
  if (!good) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  req.session.user = ADMIN_USERNAME;
  ok(res, { user: ADMIN_USERNAME });
});
app.post('/api/auth/logout', (req, res) => { req.session = null; ok(res, { ok: true }); });
app.get('/api/auth/me', (req, res) => ok(res, { user: (req.session && req.session.user) || null }));

/* ---------------------------- Businesses ------------------------------ */
app.get('/api/businesses', (req, res) => ok(res, {
  businesses: DB.listBusinesses({
    categorySlug: req.query.category, districtSlug: req.query.district,
    barrioSlug: req.query.barrio, metroSlug: req.query.metro, q: req.query.q,
  }),
}));
app.get('/api/businesses/:id', (req, res) => {
  const b = DB.getBusiness(req.params.id);
  return b ? ok(res, b) : res.status(404).json({ error: 'No encontrada' });
});
app.post('/api/businesses', requireAuth, async (req, res) => {
  if (!req.body || !String(req.body.name || '').trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  return saveAndRespond(res, DB.insertBusiness(req.body), 201);
});
app.put('/api/businesses/:id', requireAuth, async (req, res) => {
  const b = DB.updateBusiness(req.params.id, req.body || {});
  return b ? saveAndRespond(res, b) : res.status(404).json({ error: 'No encontrada' });
});
app.delete('/api/businesses/:id', requireAuth, async (req, res) => {
  return DB.removeBusiness(req.params.id) ? saveAndRespond(res, { ok: true }) : res.status(404).json({ error: 'No encontrada' });
});
app.post('/api/businesses/:id/featured', requireAuth, async (req, res) => {
  const b = DB.getBusiness(req.params.id);
  if (!b) return res.status(404).json({ error: 'No encontrada' });
  return saveAndRespond(res, DB.setFeatured(req.params.id, req.body && req.body.featured != null ? req.body.featured : !b.featured));
});
app.post('/api/businesses/reset-demo', requireAuth, async (req, res) => {
  return saveAndRespond(res, { businesses: DB.replaceAll(DEMO_BUSINESSES) });
});

/* ---------------------------- Taxonomía ------------------------------- */
app.get('/api/categories', (req, res) => ok(res, { categories: DB.getCategoryTree(), flat: DB.listCategories() }));
app.get('/api/districts', (req, res) => ok(res, { districts: DB.listDistricts() }));
app.get('/api/districts/:id/neighborhoods', (req, res) => ok(res, { neighborhoods: DB.listNeighborhoods(Number(req.params.id)) }));
app.get('/api/metros', (req, res) => ok(res, { metros: DB.listMetros() }));

app.post('/api/categories', requireAuth, async (req, res) => {
  const body = req.body || {};
  if (!String(body.name || '').trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const wanted = DB.slugify(body.slug || body.name);
  if (isReservedSlug(wanted)) return res.status(400).json({ error: 'Ese identificador (slug) está reservado, elige otro nombre.' });
  let created;
  try { created = DB.insertCategory(body); }
  catch (e) { return res.status(400).json({ error: e.message || 'No se pudo crear la categoría' }); }
  return saveAndRespond(res, created, 201);
});
app.put('/api/categories/:id', requireAuth, async (req, res) => {
  const body = req.body || {};
  if (body.slug != null && isReservedSlug(DB.slugify(body.slug))) return res.status(400).json({ error: 'Ese identificador (slug) está reservado.' });
  const c = DB.updateCategory(Number(req.params.id), body);
  return c ? saveAndRespond(res, c) : res.status(404).json({ error: 'No encontrada' });
});
app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  return DB.removeCategory(Number(req.params.id)) ? saveAndRespond(res, { ok: true }) : res.status(404).json({ error: 'No encontrada' });
});

app.post('/api/metros', requireAuth, async (req, res) => {
  if (!String((req.body || {}).name || '').trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  let created;
  try { created = DB.insertMetro(req.body); }
  catch (e) { return res.status(400).json({ error: e.message || 'No se pudo crear la estación' }); }
  return saveAndRespond(res, created, 201);
});
app.put('/api/metros/:id', requireAuth, async (req, res) => {
  const m = DB.updateMetro(Number(req.params.id), req.body || {});
  return m ? saveAndRespond(res, m) : res.status(404).json({ error: 'No encontrada' });
});
app.delete('/api/metros/:id', requireAuth, async (req, res) => {
  return DB.removeMetro(Number(req.params.id)) ? saveAndRespond(res, { ok: true }) : res.status(404).json({ error: 'No encontrada' });
});
app.post('/api/neighborhoods', requireAuth, async (req, res) => {
  const body = req.body || {};
  const districtId = Number(body.districtId);
  if (!String(body.name || '').trim() || !districtId) return res.status(400).json({ error: 'Nombre y distrito son obligatorios' });
  return saveAndRespond(res, DB.insertNeighborhood(String(body.name).trim(), body.slug, districtId), 201);
});

/* --------------------------- Export / Import -------------------------- */
app.get('/api/export', requireAuth, (req, res) => {
  ok(res, { version: 2, exportedAt: new Date().toISOString(), businesses: DB.listBusinesses() });
});
app.post('/api/import', requireAuth, async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : (req.body && (req.body.businesses || req.body.clinics));
  if (!Array.isArray(list)) return res.status(400).json({ error: 'Formato no válido: falta "businesses"' });
  return saveAndRespond(res, { businesses: DB.replaceAll(list) });
});

/* ------------------------------ Upload -------------------------------- */
app.post('/api/upload', requireAuth, (req, res) => {
  const dataUrl = req.body && req.body.dataUrl;
  const m = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Imagen no válida' });
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const buf = Buffer.from(m[3], 'base64');
  const cap = SERVERLESS ? 1.5 * 1024 * 1024 : 3 * 1024 * 1024;
  if (buf.length > cap) return res.status(413).json({ error: `Imagen demasiado grande (máx ${SERVERLESS ? '1.5' : '3'}MB)` });
  // Serverless: fără disc → returnăm data URL-ul; se stochează inline în DB.
  if (SERVERLESS) return ok(res, { url: dataUrl });
  const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
  try { fs.writeFileSync(path.join(UPLOADS_DIR, name), buf); }
  catch (e) { return res.status(500).json({ error: 'No se pudo guardar la imagen' }); }
  ok(res, { url: '/uploads/' + name });
});

/* --------------------- Import automat desde URL ----------------------- */
app.post('/api/extract', requireAuth, async (req, res) => {
  const url = req.body && String(req.body.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Falta la URL' });
  try {
    const result = await extractFromUrl(url, { uploadsDir: UPLOADS_DIR, inline: SERVERLESS });
    ok(res, result);
  } catch (e) {
    if (e.code === 'BAD_URL') return res.status(400).json({ error: e.message });
    console.error('extract error:', e);
    res.status(502).json({ error: 'No se pudo analizar el sitio web' });
  }
});

/* ---------------------------- Analytics ------------------------------- */
app.post('/api/track/visit', (req, res) => {
  const nowMs = Date.now();
  const last = (req.session && req.session.lastVisit) || 0;
  if (nowMs - last > 30 * 60 * 1000) { DB.recordEvent('visit'); req.session.lastVisit = nowMs; }
  ok(res, { ok: true });
});
app.post('/api/track/view/:id', (req, res) => { DB.recordEvent('view', req.params.id); ok(res, { ok: true }); });
app.post('/api/track/contact', (req, res) => {
  const type = req.body && req.body.type === 'web' ? 'contact_web' : 'contact_phone';
  DB.recordEvent(type); ok(res, { ok: true });
});
app.get('/api/stats', requireAuth, (req, res) => ok(res, DB.getStats()));
app.post('/api/analytics/reset', requireAuth, (req, res) => { DB.clearEvents(); seedIfEmpty(); ok(res, DB.getStats()); });

/* API 404 (doar sub /api) */
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

/* ========================= PAGINI SEO (SSR) =========================== */
app.get('/', (req, res) => sendHtml(res, R.renderHome(ctx(req))));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(R.renderSitemap(ctx(req))));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(R.renderRobots(ctx(req))));
app.get('/buscar', (req, res) => sendHtml(res, R.renderSearch(ctx(req), req.query.q)));
app.get('/zonas', (req, res) => sendHtml(res, R.renderZonesIndex(ctx(req))));

/* Páginas legales (RGPD / LSSI-CE) */
app.get('/:doc(aviso-legal|privacidad|cookies|condiciones)', (req, res, next) => {
  const html = R.renderLegal(ctx(req), req.params.doc);
  if (!html) return next();
  sendHtml(res, html);
});

app.get('/metro', (req, res) => sendHtml(res, R.renderMetroIndex(ctx(req))));
app.get('/metro/:estacion', (req, res, next) => {
  const m = DB.getMetroBySlug(req.params.estacion);
  if (!m) return next();
  sendHtml(res, R.renderMetroHub(ctx(req), m));
});

app.get('/negocio/:id', (req, res, next) => {
  const b = DB.getBusiness(req.params.id);
  if (!b) return next();
  sendHtml(res, R.renderBusiness(ctx(req), b));
});

app.get('/zona/:distrito', (req, res, next) => {
  const d = DB.getDistrictBySlug(req.params.distrito);
  if (!d) return next();
  sendHtml(res, R.renderZoneDistrict(ctx(req), d));
});
app.get('/zona/:distrito/:barrio', (req, res, next) => {
  const d = DB.getDistrictBySlug(req.params.distrito);
  if (!d) return next();
  const b = DB.getNeighborhoodBySlug(d.id, req.params.barrio);
  if (!b) return next();
  sendHtml(res, R.renderZoneBarrio(ctx(req), d, b));
});

/* /:categoria/metro/:estacion — ÎNAINTE de /:categoria/:distrito/:barrio */
app.get('/:categoria/metro/:estacion', (req, res, next) => {
  const cat = DB.getCategoryBySlug(req.params.categoria);
  const metro = DB.getMetroBySlug(req.params.estacion);
  if (!cat || !metro) return next();
  sendHtml(res, R.renderCategoryMetro(ctx(req), cat, metro));
});
app.get('/:categoria/:distrito/:barrio', (req, res, next) => {
  const cat = DB.getCategoryBySlug(req.params.categoria);
  if (!cat) return next();
  const d = DB.getDistrictBySlug(req.params.distrito);
  if (!d) return next();
  const b = DB.getNeighborhoodBySlug(d.id, req.params.barrio);
  if (!b) return next();
  sendHtml(res, R.renderBarrio(ctx(req), cat, d, b));
});
app.get('/:categoria/:distrito', (req, res, next) => {
  const cat = DB.getCategoryBySlug(req.params.categoria);
  if (!cat) return next();
  const d = DB.getDistrictBySlug(req.params.distrito);
  if (!d) return next();
  sendHtml(res, R.renderDistrict(ctx(req), cat, d));
});
app.get('/:categoria', (req, res, next) => {
  const cat = DB.getCategoryBySlug(req.params.categoria);
  if (!cat) return next();
  sendHtml(res, R.renderCategory(ctx(req), cat));
});

/* 404 HTML pentru orice altă rută GET */
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) return sendHtml(res, R.render404(ctx(req)), 404);
  res.status(404).send('Not found');
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Error del servidor');
});

/* Pe serverless (Vercel) exportăm app-ul ca handler — fără listen.
   Local (npm start) pornim serverul HTTP normal. */
if (!SERVERLESS && require.main === module) {
  ready.then(() => {
    app.listen(PORT, () => {
      const usingDefaults = ADMIN_PASSWORD === 'admin' || SESSION_SECRET === 'dev-insecure-secret-change-me';
      console.log(`\n  ${R.SITE.name}`);
      console.log(`  ▶  http://localhost:${PORT}`);
      console.log(`  ▶  Admin: http://localhost:${PORT}/admin.html  (usuario: ${ADMIN_USERNAME})`);
      console.log(`  ▶  Persistencia: ${DB.persistenceEnabled() ? 'Supabase Postgres' : (process.env.VERCEL ? 'memoria (efímera)' : 'SQLite en disco')}`);
      if (usingDefaults) console.log(`  ⚠️  Usando credenciales/secreto por defecto — crea un archivo .env (ver .env.example).`);
      console.log('');
    });
  });
}

module.exports = app;
