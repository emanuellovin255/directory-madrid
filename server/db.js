/* =========================================================================
   db.js — Persistență reală cu SQLite (node:sqlite, built-in Node 22+/24).
   Fără dependențe native. Baza de date: server/data.db
   Model: taxonomie (categories/districts/neighborhoods/metros) + businesses
   cu tabele de legătură (business_categories, business_metros).
   ========================================================================= */
'use strict';
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const pgstore = require('./pgstore');

/* Modul de rulare:
   • Cu DATABASE_URL (Supabase) SAU pe Vercel → SQLite `:memory:` (FS-ul e
     read-only pe serverless). Persistența durabilă vine din Postgres.
   • Local, fără Supabase → fișier pe disc (persistă între rulări).            */
const HAS_PG = !!process.env.DATABASE_URL;
const IN_MEMORY = HAS_PG || !!process.env.VERCEL;
const DB_PATH = IN_MEMORY ? ':memory:' : (process.env.DB_PATH || path.join(__dirname, 'data.db'));

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
if (!IN_MEMORY) db.exec('PRAGMA journal_mode = WAL;');  // WAL n-are sens pe :memory:

/* Pivot: tabelul dentar vechi nu mai există (date demo). */
db.exec('DROP TABLE IF EXISTS clinics;');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    parent_id     INTEGER,               -- NULL = categorie de nivel 1; altfel subcategorie
    icon          TEXT,
    intro         TEXT,                  -- text SEO afișat pe pagina categoriei
    display_order INTEGER DEFAULT 0,
    in_nav        INTEGER DEFAULT 1,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS districts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS neighborhoods (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT NOT NULL,
    name        TEXT NOT NULL,
    district_id INTEGER NOT NULL,
    UNIQUE (district_id, slug),
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS metros (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    slug  TEXT UNIQUE NOT NULL,
    name  TEXT NOT NULL,
    lines TEXT                          -- JSON array de linii ["1","6"]
  );
  CREATE TABLE IF NOT EXISTS businesses (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    address         TEXT,
    about           TEXT,
    district_id     INTEGER,
    neighborhood_id INTEGER,
    phone           TEXT,
    email           TEXT,
    website         TEXT,
    hours           TEXT,               -- JSON object
    social          TEXT,               -- JSON object
    rating          REAL,
    reviews         INTEGER DEFAULT 0,
    featured        INTEGER DEFAULT 0,
    photo           TEXT,
    created_at      INTEGER,
    FOREIGN KEY (district_id)     REFERENCES districts(id)     ON DELETE SET NULL,
    FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS business_categories (
    business_id TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (business_id, category_id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS business_metros (
    business_id TEXT NOT NULL,
    metro_id    INTEGER NOT NULL,
    PRIMARY KEY (business_id, metro_id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (metro_id)    REFERENCES metros(id)     ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS events (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,       -- 'visit' | 'view' | 'contact_phone' | 'contact_web'
    ref  TEXT,                -- business id (pentru 'view')
    ts   INTEGER NOT NULL     -- unix seconds
  );
  CREATE INDEX IF NOT EXISTS idx_bc_category ON business_categories(category_id);
  CREATE INDEX IF NOT EXISTS idx_bm_metro    ON business_metros(metro_id);
  CREATE INDEX IF NOT EXISTS idx_biz_district ON businesses(district_id);
  CREATE INDEX IF NOT EXISTS idx_biz_barrio   ON businesses(neighborhood_id);
  CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
  CREATE INDEX IF NOT EXISTS idx_events_ref ON events(ref);
`);

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

/* ------------------------------- Utils -------------------------------- */
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'negocio';
}
function now() { return Math.floor(Date.now() / 1000); }
function safeParse(s, fb) { try { return s ? JSON.parse(s) : fb; } catch { return fb; } }

/* ============================ CATEGORIES ============================== */
function parseCategory(r) {
  if (!r) return null;
  return {
    id: r.id, slug: r.slug, name: r.name,
    parent_id: r.parent_id != null ? r.parent_id : null,
    icon: r.icon || null, intro: r.intro || '',
    display_order: r.display_order || 0, in_nav: !!r.in_nav,
  };
}
function getCategory(id) { return parseCategory(db.prepare('SELECT * FROM categories WHERE id=?').get(id)); }
function getCategoryBySlug(slug) { return parseCategory(db.prepare('SELECT * FROM categories WHERE slug=?').get(String(slug || ''))); }
function listCategories() { return db.prepare('SELECT * FROM categories ORDER BY parent_id IS NOT NULL, display_order, name').all().map(parseCategory); }
function countCategories() { return db.prepare('SELECT COUNT(*) c FROM categories').get().c; }

function getCategoryTree() {
  const tops = db.prepare('SELECT * FROM categories WHERE parent_id IS NULL ORDER BY display_order, name').all().map(parseCategory);
  const kids = db.prepare('SELECT * FROM categories WHERE parent_id=? ORDER BY display_order, name');
  tops.forEach(t => { t.children = kids.all(t.id).map(parseCategory); });
  return tops;
}
function descendantCategoryIds(id) {
  const out = [id];
  db.prepare('SELECT id FROM categories WHERE parent_id=?').all(id).forEach(k => out.push(...descendantCategoryIds(k.id)));
  return out;
}
function uniqueCategorySlug(base, exceptId) {
  const q = db.prepare('SELECT id FROM categories WHERE slug=?');
  let slug = base, n = 2;
  for (;;) {
    const row = q.get(slug);
    if (!row || (exceptId && row.id === exceptId)) return slug;
    slug = base + '-' + n; n++;
  }
}
function resolveParentId(data) {
  if (data.parentId != null && data.parentId !== '') return Number(data.parentId);
  if (data.parentSlug) { const p = getCategoryBySlug(data.parentSlug); return p ? p.id : null; }
  return null;
}
function insertCategory(data) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Nombre de categoría obligatorio');
  const slug = uniqueCategorySlug(slugify(data.slug || name));
  const info = db.prepare(`INSERT INTO categories (slug,name,parent_id,icon,intro,display_order,in_nav)
    VALUES (?,?,?,?,?,?,?)`).run(
    slug, name, resolveParentId(data), data.icon || null, String(data.intro || ''),
    parseInt(data.display_order, 10) || 0, data.in_nav === 0 || data.in_nav === false ? 0 : 1);
  return getCategory(Number(info.lastInsertRowid));
}
function updateCategory(id, data) {
  const cur = getCategory(id);
  if (!cur) return null;
  const name = data.name != null ? String(data.name).trim() : cur.name;
  const slug = data.slug != null ? uniqueCategorySlug(slugify(data.slug), id) : cur.slug;
  const parent_id = ('parentId' in data || 'parentSlug' in data) ? resolveParentId(data) : cur.parent_id;
  db.prepare(`UPDATE categories SET name=?,slug=?,parent_id=?,icon=?,intro=?,display_order=?,in_nav=? WHERE id=?`).run(
    name, slug, parent_id,
    'icon' in data ? (data.icon || null) : cur.icon,
    'intro' in data ? String(data.intro || '') : cur.intro,
    'display_order' in data ? (parseInt(data.display_order, 10) || 0) : cur.display_order,
    'in_nav' in data ? (data.in_nav ? 1 : 0) : (cur.in_nav ? 1 : 0),
    id);
  return getCategory(id);
}
function removeCategory(id) { return db.prepare('DELETE FROM categories WHERE id=?').run(id).changes > 0; }

/* ============================ DISTRICTS ============================== */
function parseDistrict(r) { return r ? { id: r.id, slug: r.slug, name: r.name, display_order: r.display_order || 0 } : null; }
function listDistricts() { return db.prepare('SELECT * FROM districts ORDER BY display_order, name').all().map(parseDistrict); }
function getDistrict(id) { return parseDistrict(db.prepare('SELECT * FROM districts WHERE id=?').get(id)); }
function getDistrictBySlug(slug) { return parseDistrict(db.prepare('SELECT * FROM districts WHERE slug=?').get(String(slug || ''))); }
function countDistricts() { return db.prepare('SELECT COUNT(*) c FROM districts').get().c; }
function insertDistrict(name, slug, order) {
  const info = db.prepare('INSERT INTO districts (slug,name,display_order) VALUES (?,?,?)').run(slug || slugify(name), name, order || 0);
  return getDistrict(Number(info.lastInsertRowid));
}

/* ========================== NEIGHBORHOODS =========================== */
function parseNeighborhood(r) { return r ? { id: r.id, slug: r.slug, name: r.name, district_id: r.district_id } : null; }
function listNeighborhoods(districtId) {
  const rows = districtId
    ? db.prepare('SELECT * FROM neighborhoods WHERE district_id=? ORDER BY name').all(districtId)
    : db.prepare('SELECT * FROM neighborhoods ORDER BY name').all();
  return rows.map(parseNeighborhood);
}
function getNeighborhood(id) { return parseNeighborhood(db.prepare('SELECT * FROM neighborhoods WHERE id=?').get(id)); }
function getNeighborhoodBySlug(districtId, slug) { return parseNeighborhood(db.prepare('SELECT * FROM neighborhoods WHERE district_id=? AND slug=?').get(districtId, String(slug || ''))); }
function insertNeighborhood(name, slug, districtId) {
  const info = db.prepare('INSERT INTO neighborhoods (slug,name,district_id) VALUES (?,?,?)').run(slug || slugify(name), name, districtId);
  return getNeighborhood(Number(info.lastInsertRowid));
}

/* ============================== METROS ============================== */
function parseMetro(r) { return r ? { id: r.id, slug: r.slug, name: r.name, lines: safeParse(r.lines, []) } : null; }
function listMetros() { return db.prepare('SELECT * FROM metros ORDER BY name').all().map(parseMetro); }
function getMetro(id) { return parseMetro(db.prepare('SELECT * FROM metros WHERE id=?').get(id)); }
function getMetroBySlug(slug) { return parseMetro(db.prepare('SELECT * FROM metros WHERE slug=?').get(String(slug || ''))); }
function countMetros() { return db.prepare('SELECT COUNT(*) c FROM metros').get().c; }
function uniqueMetroSlug(base, exceptId) {
  const q = db.prepare('SELECT id FROM metros WHERE slug=?');
  let slug = base, n = 2;
  for (;;) { const row = q.get(slug); if (!row || (exceptId && row.id === exceptId)) return slug; slug = base + '-' + n; n++; }
}
function insertMetro(data) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Nombre de estación obligatorio');
  const slug = uniqueMetroSlug(slugify(data.slug || name));
  const lines = Array.isArray(data.lines) ? data.lines : (data.lines ? String(data.lines).split(/[,\s]+/).filter(Boolean) : []);
  const info = db.prepare('INSERT INTO metros (slug,name,lines) VALUES (?,?,?)').run(slug, name, JSON.stringify(lines));
  return getMetro(Number(info.lastInsertRowid));
}
function updateMetro(id, data) {
  const cur = getMetro(id);
  if (!cur) return null;
  const name = data.name != null ? String(data.name).trim() : cur.name;
  const slug = data.slug != null ? uniqueMetroSlug(slugify(data.slug), id) : cur.slug;
  const lines = 'lines' in data ? (Array.isArray(data.lines) ? data.lines : String(data.lines || '').split(/[,\s]+/).filter(Boolean)) : cur.lines;
  db.prepare('UPDATE metros SET name=?,slug=?,lines=? WHERE id=?').run(name, slug, JSON.stringify(lines), id);
  return getMetro(id);
}
function removeMetro(id) { return db.prepare('DELETE FROM metros WHERE id=?').run(id).changes > 0; }

/* ============================ BUSINESSES ============================= */
function resolveDistrictId(data) {
  if (data.districtId != null && data.districtId !== '') return Number(data.districtId) || null;
  if (data.districtSlug) { const d = getDistrictBySlug(data.districtSlug); return d ? d.id : null; }
  if (data.district && typeof data.district === 'object') {
    if (data.district.id) return Number(data.district.id) || null;
    if (data.district.slug) { const d = getDistrictBySlug(data.district.slug); return d ? d.id : null; }
  }
  return null;
}
function resolveNeighborhoodId(data, districtId) {
  if (data.neighborhoodId != null && data.neighborhoodId !== '') return Number(data.neighborhoodId) || null;
  if (data.neighborhood && typeof data.neighborhood === 'object' && data.neighborhood.id) return Number(data.neighborhood.id) || null;
  const bySlug = data.neighborhoodSlug || (data.neighborhood && typeof data.neighborhood === 'object' ? data.neighborhood.slug : null);
  if (bySlug && districtId) { const n = getNeighborhoodBySlug(districtId, bySlug); return n ? n.id : null; }
  return null;
}
function collectTaxonomyIds(data, keyIds, keySlugs, keyObjects, bySlugFn) {
  const ids = new Set();
  const addId = x => { const n = Number(x); if (n) ids.add(n); };
  const addSlug = s => { const g = bySlugFn(s); if (g) ids.add(g.id); };
  (Array.isArray(data[keyIds]) ? data[keyIds] : []).forEach(addId);
  (Array.isArray(data[keySlugs]) ? data[keySlugs] : []).forEach(addSlug);
  (Array.isArray(data[keyObjects]) ? data[keyObjects] : []).forEach(x => {
    if (x == null) return;
    if (typeof x === 'object') { if (x.id) addId(x.id); else if (x.slug) addSlug(x.slug); }
    else if (typeof x === 'number') addId(x);
    else if (typeof x === 'string') addSlug(x);
  });
  return [...ids];
}
function resolveCategoryIds(data) { return collectTaxonomyIds(data, 'categoryIds', 'categorySlugs', 'categories', getCategoryBySlug); }
function resolveMetroIds(data) { return collectTaxonomyIds(data, 'metroIds', 'metroSlugs', 'metros', getMetroBySlug); }
function normalizeBusiness(data) {
  const hours = {};
  DAYS.forEach(d => { hours[d] = (data.hours && data.hours[d]) || 'Cerrado'; });
  const rating = data.rating === '' || data.rating == null ? null : Number(data.rating);
  const districtId = resolveDistrictId(data);
  return {
    name: String(data.name || '').trim(),
    address: String(data.address || '').trim(),
    about: String(data.about || '').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    website: String(data.website || '').trim(),
    hours,
    social: data.social && typeof data.social === 'object' ? data.social : {},
    rating: rating != null && !isNaN(rating) ? Math.min(5, Math.max(0, rating)) : null,
    reviews: parseInt(data.reviews, 10) || 0,
    featured: data.featured ? 1 : 0,
    photo: data.photo || null,
    districtId,
    neighborhoodId: resolveNeighborhoodId(data, districtId),
    categoryIds: resolveCategoryIds(data),
    metroIds: resolveMetroIds(data),
  };
}
function parseBusinessRow(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name,
    address: r.address || '', about: r.about || '',
    phone: r.phone || '', email: r.email || '', website: r.website || '',
    hours: safeParse(r.hours, {}), social: safeParse(r.social, {}),
    rating: r.rating != null ? r.rating : null, reviews: r.reviews || 0,
    featured: !!r.featured, photo: r.photo || null,
    district_id: r.district_id || null, neighborhood_id: r.neighborhood_id || null,
  };
}
function attachRelations(b) {
  if (!b) return null;
  b.district = b.district_id ? getDistrict(b.district_id) : null;
  b.neighborhood = b.neighborhood_id ? getNeighborhood(b.neighborhood_id) : null;
  b.categories = db.prepare(`SELECT c.* FROM categories c JOIN business_categories bc ON bc.category_id=c.id
    WHERE bc.business_id=? ORDER BY c.parent_id IS NOT NULL, c.name`).all(b.id).map(parseCategory);
  b.metros = db.prepare(`SELECT m.* FROM metros m JOIN business_metros bm ON bm.metro_id=m.id
    WHERE bm.business_id=? ORDER BY m.name`).all(b.id).map(parseMetro);
  // șir „zonă" pentru afișare compactă (barrio · distrito)
  b.zone = b.neighborhood ? (b.neighborhood.name + (b.district ? ' · ' + b.district.name : '')) : (b.district ? b.district.name : '');
  return b;
}
function setBusinessCategories(id, ids) {
  db.prepare('DELETE FROM business_categories WHERE business_id=?').run(id);
  const ins = db.prepare('INSERT OR IGNORE INTO business_categories (business_id,category_id) VALUES (?,?)');
  (ids || []).forEach(cid => { try { ins.run(id, cid); } catch { /* categorie inexistentă → ignoră */ } });
}
function setBusinessMetros(id, ids) {
  db.prepare('DELETE FROM business_metros WHERE business_id=?').run(id);
  const ins = db.prepare('INSERT OR IGNORE INTO business_metros (business_id,metro_id) VALUES (?,?)');
  (ids || []).forEach(mid => { try { ins.run(id, mid); } catch { /* stație inexistentă → ignoră */ } });
}

function uniqueId(base) {
  let id = base, n = 2;
  const exists = db.prepare('SELECT 1 FROM businesses WHERE id=?');
  while (exists.get(id)) { id = base + '-' + n; n++; }
  return id;
}
const _insertBiz = db.prepare(`INSERT INTO businesses
  (id,name,address,about,district_id,neighborhood_id,phone,email,website,hours,social,rating,reviews,featured,photo,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const _updateBiz = db.prepare(`UPDATE businesses SET
  name=?,address=?,about=?,district_id=?,neighborhood_id=?,phone=?,email=?,website=?,hours=?,social=?,rating=?,reviews=?,featured=?,photo=?
  WHERE id=?`);

function insertBusiness(data, forcedId) {
  const b = normalizeBusiness(data);
  const id = forcedId || uniqueId(slugify(data.id || b.name));
  _insertBiz.run(id, b.name, b.address, b.about, b.districtId, b.neighborhoodId,
    b.phone, b.email, b.website, JSON.stringify(b.hours), JSON.stringify(b.social),
    b.rating, b.reviews, b.featured, b.photo, now());
  setBusinessCategories(id, b.categoryIds);
  setBusinessMetros(id, b.metroIds);
  return getBusiness(id);
}
function businessToInput(b) {
  return {
    name: b.name, address: b.address, about: b.about, hours: b.hours, social: b.social,
    phone: b.phone, email: b.email, website: b.website, rating: b.rating, reviews: b.reviews,
    featured: b.featured, photo: b.photo,
    districtId: b.district ? b.district.id : null,
    neighborhoodId: b.neighborhood ? b.neighborhood.id : null,
    categoryIds: (b.categories || []).map(c => c.id),
    metroIds: (b.metros || []).map(m => m.id),
  };
}
function updateBusiness(id, data) {
  const existing = getBusiness(id);
  if (!existing) return null;
  const merged = Object.assign({}, businessToInput(existing), data);
  const b = normalizeBusiness(merged);
  _updateBiz.run(b.name, b.address, b.about, b.districtId, b.neighborhoodId,
    b.phone, b.email, b.website, JSON.stringify(b.hours), JSON.stringify(b.social),
    b.rating, b.reviews, b.featured, b.photo, id);
  setBusinessCategories(id, b.categoryIds);
  setBusinessMetros(id, b.metroIds);
  return getBusiness(id);
}
function removeBusiness(id) { return db.prepare('DELETE FROM businesses WHERE id=?').run(id).changes > 0; }
function setFeatured(id, val) { db.prepare('UPDATE businesses SET featured=? WHERE id=?').run(val ? 1 : 0, id); return getBusiness(id); }
function getBusiness(id) { return attachRelations(parseBusinessRow(db.prepare('SELECT * FROM businesses WHERE id=?').get(id))); }
function countBusinesses() { return db.prepare('SELECT COUNT(*) c FROM businesses').get().c; }

function listBusinesses(filter) {
  filter = filter || {};
  const where = [];
  const params = [];
  let dead = false;

  const catSlug = filter.categorySlug;
  const catId = filter.categoryId;
  if (catSlug || catId) {
    const cat = catSlug ? getCategoryBySlug(catSlug) : getCategory(catId);
    if (!cat) dead = true;
    else {
      const ids = descendantCategoryIds(cat.id);
      where.push(`EXISTS (SELECT 1 FROM business_categories bc WHERE bc.business_id=b.id AND bc.category_id IN (${ids.map(() => '?').join(',')}))`);
      params.push(...ids);
    }
  }
  let district = null;
  if (filter.districtSlug || filter.districtId) {
    district = filter.districtSlug ? getDistrictBySlug(filter.districtSlug) : getDistrict(filter.districtId);
    if (!district) dead = true;
    else { where.push('b.district_id=?'); params.push(district.id); }
  }
  if (filter.barrioSlug || filter.neighborhoodId) {
    let n = null;
    if (filter.neighborhoodId) n = getNeighborhood(filter.neighborhoodId);
    else if (district) n = getNeighborhoodBySlug(district.id, filter.barrioSlug);
    if (!n) dead = true;
    else { where.push('b.neighborhood_id=?'); params.push(n.id); }
  }
  if (filter.metroSlug || filter.metroId) {
    const m = filter.metroSlug ? getMetroBySlug(filter.metroSlug) : getMetro(filter.metroId);
    if (!m) dead = true;
    else { where.push('EXISTS (SELECT 1 FROM business_metros bm WHERE bm.business_id=b.id AND bm.metro_id=?)'); params.push(m.id); }
  }
  if (filter.featured) where.push('b.featured=1');
  if (filter.q) {
    const like = '%' + String(filter.q).trim() + '%';
    where.push('(b.name LIKE ? OR b.about LIKE ? OR b.address LIKE ?)');
    params.push(like, like, like);
  }
  if (dead) return [];

  const sql = `SELECT b.* FROM businesses b ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY b.featured DESC, b.rating DESC, b.name ASC`;
  const rows = db.prepare(sql).all(...params);
  const out = rows.map(r => attachRelations(parseBusinessRow(r)));
  return filter.limit ? out.slice(0, filter.limit) : out;
}

function replaceAll(items) {
  db.prepare('DELETE FROM businesses').run();  // cascade curăță tabelele de legătură
  const seen = new Set();
  const out = [];
  (items || []).forEach(item => {
    let base = slugify(item.id || item.name), id = base, n = 2;
    while (seen.has(id)) { id = base + '-' + n; n++; }
    seen.add(id);
    out.push(insertBusiness(item, id));
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
  const rows = db.prepare(`SELECT strftime('%Y-%m', ts, 'unixepoch', 'localtime') m, COUNT(*) c FROM events WHERE type='visit' GROUP BY m`).all();
  const map = {}; rows.forEach(r => { map[r.m] = r.c; }); return map;
}
function getMonthlySeries(n) {
  n = n || 6;
  const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const map = visitsByMonth(); const nowD = new Date(); const out = [];
  for (let i = n - 1; i >= 0; i--) { const dt = addMonths(nowD, -i); out.push({ key: monthKeyOf(dt), label: MONTHS_ES[dt.getMonth()], value: map[monthKeyOf(dt)] || 0 }); }
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
  const topRows = db.prepare(`SELECT ref, COUNT(*) c FROM events WHERE type='view' AND ref IS NOT NULL GROUP BY ref ORDER BY c DESC LIMIT 5`).all();
  const top = topRows.map(r => { const b = getBusiness(r.ref); return b ? { id: b.id, name: b.name, zone: b.zone, photo: b.photo, views: r.c } : null; }).filter(Boolean);
  return {
    totals: { total, thisMonth, lastMonth: prev1, growth, totalViews, contactsPhone, contactsWeb },
    series: getMonthlySeries(6),
    top,
  };
}

/* ----------------------- Persistență Supabase ------------------------- */
/* Se apelează O DATĂ la boot, ÎNAINTE de a servi cereri: pornește pool-ul
   Postgres, creează schema și încarcă datele în SQLite-ul in-memory.
   Returnează numărul de rânduri încărcate (0 → trebuie seed). */
async function initPersistence(injectedPool) {
  if (!pgstore.init(injectedPool)) return 0;   // fără DATABASE_URL → nimic de făcut
  await pgstore.ensureSchema();
  return pgstore.hydrate(db);
}
/* Rescrie starea curentă în Postgres. No-op dacă nu e configurat Supabase.
   Se apelează (await) după fiecare scriere de admin. */
async function persist() {
  if (!pgstore.isEnabled()) return;
  await pgstore.dump(db);
}
function persistenceEnabled() { return pgstore.isEnabled(); }

module.exports = {
  db, DAYS, slugify, now,
  initPersistence, persist, persistenceEnabled,
  // categories
  listCategories, getCategoryTree, getCategory, getCategoryBySlug, insertCategory, updateCategory, removeCategory, descendantCategoryIds, countCategories,
  // districts / neighborhoods
  listDistricts, getDistrict, getDistrictBySlug, countDistricts, insertDistrict,
  listNeighborhoods, getNeighborhood, getNeighborhoodBySlug, insertNeighborhood,
  // metros
  listMetros, getMetro, getMetroBySlug, insertMetro, updateMetro, removeMetro, countMetros,
  // businesses
  insertBusiness, updateBusiness, removeBusiness, setFeatured, getBusiness, listBusinesses, countBusinesses, replaceAll,
  // events / stats
  recordEvent, countEvents, clearEvents, getStats, getMonthlySeries,
};
