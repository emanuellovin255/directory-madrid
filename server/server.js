/* =========================================================================
   server.js — Express: servește frontend-ul (public/) + API REST.
   Auth reală (cookie-session), upload poze pe disc, analytics real.
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
const { seedIfEmpty, DEMO_CLINICS } = require('./seed');

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ------------------------------ Seed ---------------------------------- */
seedIfEmpty();

/* ------------------------------ App ----------------------------------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use(cookieSession({
  name: 'ddm_sess',
  secret: SESSION_SECRET,
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
}));

/* Fișiere statice */
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(express.static(PUBLIC_DIR));

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

/* ------------------------------- Auth --------------------------------- */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const good = safeEqual(username || '', ADMIN_USERNAME) & safeEqual(password || '', ADMIN_PASSWORD);
  if (!good) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  req.session.user = ADMIN_USERNAME;
  ok(res, { user: ADMIN_USERNAME });
});
app.post('/api/auth/logout', (req, res) => { req.session = null; ok(res, { ok: true }); });
app.get('/api/auth/me', (req, res) => ok(res, { user: (req.session && req.session.user) || null }));

/* ----------------------------- Clinics -------------------------------- */
app.get('/api/clinics', (req, res) => ok(res, { clinics: DB.listClinics() }));
app.get('/api/clinics/:id', (req, res) => {
  const c = DB.getClinic(req.params.id);
  return c ? ok(res, c) : res.status(404).json({ error: 'No encontrada' });
});
app.post('/api/clinics', requireAuth, (req, res) => {
  if (!req.body || !String(req.body.name || '').trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  ok(res.status(201), DB.insertClinic(req.body));
});
app.put('/api/clinics/:id', requireAuth, (req, res) => {
  const c = DB.updateClinic(req.params.id, req.body || {});
  return c ? ok(res, c) : res.status(404).json({ error: 'No encontrada' });
});
app.delete('/api/clinics/:id', requireAuth, (req, res) => {
  return DB.removeClinic(req.params.id) ? ok(res, { ok: true }) : res.status(404).json({ error: 'No encontrada' });
});
app.post('/api/clinics/:id/featured', requireAuth, (req, res) => {
  const c = DB.getClinic(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrada' });
  ok(res, DB.setFeatured(req.params.id, req.body && req.body.featured != null ? req.body.featured : !c.featured));
});

app.post('/api/clinics/reset-demo', requireAuth, (req, res) => {
  ok(res, { clinics: DB.replaceAll(DEMO_CLINICS) });
});

/* --------------------------- Export / Import -------------------------- */
app.get('/api/export', requireAuth, (req, res) => {
  ok(res, { version: 1, exportedAt: new Date().toISOString(), clinics: DB.listClinics() });
});
app.post('/api/import', requireAuth, (req, res) => {
  const list = Array.isArray(req.body) ? req.body : (req.body && req.body.clinics);
  if (!Array.isArray(list)) return res.status(400).json({ error: 'Formato no válido: falta "clinics"' });
  ok(res, { clinics: DB.replaceAll(list) });
});

/* ------------------------------ Upload -------------------------------- */
app.post('/api/upload', requireAuth, (req, res) => {
  const dataUrl = req.body && req.body.dataUrl;
  const m = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Imagen no válida' });
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Imagen demasiado grande (máx 3MB)' });
  const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
  try { fs.writeFileSync(path.join(UPLOADS_DIR, name), buf); }
  catch (e) { return res.status(500).json({ error: 'No se pudo guardar la imagen' }); }
  ok(res, { url: '/uploads/' + name });
});

/* ---------------------------- Analytics ------------------------------- */
app.post('/api/track/visit', (req, res) => {
  const nowMs = Date.now();
  const last = (req.session && req.session.lastVisit) || 0;
  if (nowMs - last > 30 * 60 * 1000) {         // o vizită per sesiune (fereastră 30 min)
    DB.recordEvent('visit');
    req.session.lastVisit = nowMs;
  }
  ok(res, { ok: true });
});
app.post('/api/track/view/:id', (req, res) => { DB.recordEvent('view', req.params.id); ok(res, { ok: true }); });
app.post('/api/track/contact', (req, res) => {
  const type = req.body && req.body.type === 'web' ? 'contact_web' : 'contact_phone';
  DB.recordEvent(type); ok(res, { ok: true });
});
app.get('/api/stats', requireAuth, (req, res) => ok(res, DB.getStats()));
app.post('/api/analytics/reset', requireAuth, (req, res) => {
  DB.clearEvents();
  seedIfEmpty();            // repopulează istoricul demo
  ok(res, DB.getStats());
});

/* ------------------------------ Fallback ------------------------------ */
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

app.listen(PORT, () => {
  const usingDefaults = ADMIN_PASSWORD === 'admin' || SESSION_SECRET === 'dev-insecure-secret-change-me';
  console.log(`\n  Directorio Dental Madrid`);
  console.log(`  ▶  http://localhost:${PORT}`);
  console.log(`  ▶  Admin: http://localhost:${PORT}/admin.html  (usuario: ${ADMIN_USERNAME})`);
  if (usingDefaults) console.log(`  ⚠️  Usando credenciales/secreto por defecto — crea un archivo .env (ver .env.example).`);
  console.log('');
});
