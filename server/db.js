/* =========================================================================
   db.js — Persistență reală cu SQLite (node:sqlite, built-in Node 22+/24).
   Fără dependențe native. Baza de date: server/data.db
   ========================================================================= */
'use strict';
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS clinics (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    zone       TEXT,
    address    TEXT,
    about      TEXT,
    services   TEXT,          -- JSON array
    hours      TEXT,          -- JSON object
    phone      TEXT,
    email      TEXT,
    website    TEXT,
    social     TEXT,          -- JSON object
    rating     REAL,
    reviews    INTEGER DEFAULT 0,
    featured   INTEGER DEFAULT 0,
    photo      TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS events (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,       -- 'visit' | 'view' | 'contact_phone' | 'contact_web'
    ref  TEXT,                -- clinic id (pentru 'view')
    ts   INTEGER NOT NULL     -- unix seconds
  );
  CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
  CREATE INDEX IF NOT EXISTS idx_events_ref ON events(ref);
`);

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

/* ------------------------------- Utils -------------------------------- */
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'clinica';
}
function now() { return Math.floor(Date.now() / 1000); }

function normalize(data) {
  const hours = {};
  DAYS.forEach(d => { hours[d] = (data.hours && data.hours[d]) || 'Cerrado'; });
  const rating = data.rating === '' || data.rating == null ? null : Number(data.rating);
  return {
    name: String(data.name || '').trim(),
    zone: String(data.zone || '').trim(),
    address: String(data.address || '').trim(),
    about: String(data.about || '').trim(),
    services: Array.isArray(data.services) ? data.services.filter(Boolean) : [],
    hours,
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    website: String(data.website || '').trim(),
    social: data.social && typeof data.social === 'object' ? data.social : {},
    rating: rating != null && !isNaN(rating) ? Math.min(5, Math.max(0, rating)) : null,
    reviews: parseInt(data.reviews, 10) || 0,
    featured: data.featured ? 1 : 0,
    photo: data.photo || null,
  };
}

function parseRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    zone: r.zone || '',
    address: r.address || '',
    about: r.about || '',
    services: safeParse(r.services, []),
    hours: safeParse(r.hours, {}),
    phone: r.phone || '',
    email: r.email || '',
    website: r.website || '',
    social: safeParse(r.social, {}),
    rating: r.rating != null ? r.rating : null,
    reviews: r.reviews || 0,
    featured: !!r.featured,
    photo: r.photo || null,
  };
}
function safeParse(s, fb) { try { return s ? JSON.parse(s) : fb; } catch { return fb; } }

function uniqueId(base) {
  let id = base, n = 2;
  const exists = db.prepare('SELECT 1 FROM clinics WHERE id = ?');
  while (exists.get(id)) { id = base + '-' + n; n++; }
  return id;
}

/* ---------------------------- Clinics CRUD ---------------------------- */
const _insert = db.prepare(`INSERT INTO clinics
  (id,name,zone,address,about,services,hours,phone,email,website,social,rating,reviews,featured,photo,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

function insertClinic(data, forcedId) {
  const c = normalize(data);
  const id = forcedId || uniqueId(slugify(data.id || c.name));
  _insert.run(id, c.name, c.zone, c.address, c.about,
    JSON.stringify(c.services), JSON.stringify(c.hours), c.phone, c.email, c.website,
    JSON.stringify(c.social), c.rating, c.reviews, c.featured, c.photo, now());
  return getClinic(id);
}

const _update = db.prepare(`UPDATE clinics SET
  name=?,zone=?,address=?,about=?,services=?,hours=?,phone=?,email=?,website=?,social=?,rating=?,reviews=?,featured=?,photo=?
  WHERE id=?`);

function updateClinic(id, data) {
  const existing = getClinic(id);
  if (!existing) return null;
  const c = normalize(Object.assign({}, existing, data));
  _update.run(c.name, c.zone, c.address, c.about,
    JSON.stringify(c.services), JSON.stringify(c.hours), c.phone, c.email, c.website,
    JSON.stringify(c.social), c.rating, c.reviews, c.featured, c.photo, id);
  return getClinic(id);
}

function removeClinic(id) { return db.prepare('DELETE FROM clinics WHERE id=?').run(id).changes > 0; }
function setFeatured(id, val) { db.prepare('UPDATE clinics SET featured=? WHERE id=?').run(val ? 1 : 0, id); return getClinic(id); }
function getClinic(id) { return parseRow(db.prepare('SELECT * FROM clinics WHERE id=?').get(id)); }
function listClinics() { return db.prepare('SELECT * FROM clinics ORDER BY featured DESC, rating DESC, name ASC').all().map(parseRow); }
function countClinics() { return db.prepare('SELECT COUNT(*) c FROM clinics').get().c; }

function replaceAll(clinics) {
  const tx = db.prepare('DELETE FROM clinics');
  tx.run();
  const seen = new Set();
  const out = [];
  (clinics || []).forEach(item => {
    let base = slugify(item.id || item.name);
    let id = base, n = 2;
    while (seen.has(id)) { id = base + '-' + n; n++; }
    seen.add(id);
    out.push(insertClinic(item, id));
  });
  return out;
}

/* ------------------------------ Events -------------------------------- */
const _event = db.prepare('INSERT INTO events (type, ref, ts) VALUES (?,?,?)');
function recordEvent(type, ref, ts) { _event.run(type, ref || null, ts || now()); }
function countEvents() { return db.prepare('SELECT COUNT(*) c FROM events').get().c; }
function clearEvents() { db.prepare('DELETE FROM events').run(); }

function monthKeyOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function addMonths(d, delta) { return new Date(d.getFullYear(), d.getMonth() + delta, 1); }

function visitsByMonth() {
  const rows = db.prepare(
    `SELECT strftime('%Y-%m', ts, 'unixepoch', 'localtime') m, COUNT(*) c
     FROM events WHERE type='visit' GROUP BY m`
  ).all();
  const map = {};
  rows.forEach(r => { map[r.m] = r.c; });
  return map;
}

function getMonthlySeries(n) {
  n = n || 6;
  const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const map = visitsByMonth();
  const nowD = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = addMonths(nowD, -i);
    out.push({ key: monthKeyOf(dt), label: MONTHS_ES[dt.getMonth()], value: map[monthKeyOf(dt)] || 0 });
  }
  return out;
}

function getStats() {
  const map = visitsByMonth();
  const nowD = new Date();
  const total = db.prepare(`SELECT COUNT(*) c FROM events WHERE type='visit'`).get().c;
  const thisMonth = map[monthKeyOf(nowD)] || 0;
  const prev1 = map[monthKeyOf(addMonths(nowD, -1))] || 0;
  const prev2 = map[monthKeyOf(addMonths(nowD, -2))] || 0;
  const growth = prev2 ? Math.round(((prev1 - prev2) / prev2) * 100) : null;
  const totalViews = db.prepare(`SELECT COUNT(*) c FROM events WHERE type='view'`).get().c;
  const contactsPhone = db.prepare(`SELECT COUNT(*) c FROM events WHERE type='contact_phone'`).get().c;
  const contactsWeb = db.prepare(`SELECT COUNT(*) c FROM events WHERE type='contact_web'`).get().c;

  const topRows = db.prepare(
    `SELECT ref, COUNT(*) c FROM events WHERE type='view' AND ref IS NOT NULL GROUP BY ref ORDER BY c DESC LIMIT 5`
  ).all();
  const top = topRows.map(r => {
    const c = getClinic(r.ref);
    return c ? { id: c.id, name: c.name, zone: c.zone, photo: c.photo, views: r.c } : null;
  }).filter(Boolean);

  return {
    totals: { total, thisMonth, lastMonth: prev1, growth, totalViews, contactsPhone, contactsWeb },
    series: getMonthlySeries(6),
    top,
  };
}

module.exports = {
  db, DAYS, slugify, now,
  insertClinic, updateClinic, removeClinic, setFeatured, getClinic, listClinics, countClinics, replaceAll,
  recordEvent, countEvents, clearEvents, getStats, getMonthlySeries,
};
