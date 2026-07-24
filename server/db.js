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

/* Geografie: distingem cele 21 de distritos ale capitalei (madrid-geo.json) de
   cele 178 de municipios ale Comunidad de Madrid (madrid-municipios.json).
   Ambele trăiesc în tabelul `districts`; „kind" și „zona" se DERIVĂ din slug
   (fără coloană nouă → fără migrare în Postgres). */
const GEO = require('./data/madrid-geo.json');
const MUNIS = require('./data/madrid-municipios.json');
const DISTRITO_SLUGS = new Set(GEO.districts.map(d => d.slug));
const MUNI_ZONA = new Map(MUNIS.municipios.map(m => [m.slug, m.zona]));
const ZONES = MUNIS.zones;                       // [{slug,name}] în ordinea de afișare
function districtKind(slug) { return DISTRITO_SLUGS.has(slug) ? 'distrito' : 'municipio'; }
function districtZona(slug) { return MUNI_ZONA.get(slug) || null; }

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
    photo           TEXT,               -- imagine de copertă (compat)
    logo            TEXT,               -- logo-ul firmei
    photos          TEXT,               -- JSON array de URL-uri (galerie de servicii)
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
  CREATE TABLE IF NOT EXISTS placements (
    context     TEXT NOT NULL,        -- 'home' | 'cat:<slug>' | 'cat:<slug>:zona:<z>' | 'cat:<slug>:mun:<d>'
    business_id TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (context, business_id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS events (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,       -- 'visit' | 'view' | 'contact_phone' | 'contact_web'
    ref  TEXT,                -- business id (pentru 'view')
    ts   INTEGER NOT NULL     -- unix seconds
  );
  CREATE TABLE IF NOT EXISTS leads (
    id          TEXT PRIMARY KEY,
    business_id TEXT,               -- negocio la care se cere presupuesto (nullable); FĂRĂ FK: lead-ul supraviețuiește ștergerii firmei
    name        TEXT NOT NULL,
    phone       TEXT,
    email       TEXT,
    message     TEXT,
    context     TEXT,               -- eticheta paginii (ex. "Fontaneros · Salamanca")
    source_url  TEXT,               -- URL-ul de unde s-a trimis
    status      TEXT NOT NULL DEFAULT 'new',  -- new | contacted | archived
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_leads_business ON leads(business_id);
  CREATE INDEX IF NOT EXISTS idx_bc_category ON business_categories(category_id);
  CREATE INDEX IF NOT EXISTS idx_bm_metro    ON business_metros(metro_id);
  CREATE INDEX IF NOT EXISTS idx_biz_district ON businesses(district_id);
  CREATE INDEX IF NOT EXISTS idx_biz_barrio   ON businesses(neighborhood_id);
  CREATE INDEX IF NOT EXISTS idx_placements_ctx ON placements(context, position);
  CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
  CREATE INDEX IF NOT EXISTS idx_events_ref ON events(ref);
`);

/* Migrare idempotentă: pe un data.db vechi, `CREATE TABLE IF NOT EXISTS` nu adaugă
   coloanele noi → le adăugăm manual dacă lipsesc (fără a pierde datele). */
(function migrateBusinessColumns() {
  const cols = db.prepare('PRAGMA table_info(businesses)').all().map(c => c.name);
  if (!cols.includes('logo')) db.exec('ALTER TABLE businesses ADD COLUMN logo TEXT');
  if (!cols.includes('photos')) db.exec('ALTER TABLE businesses ADD COLUMN photos TEXT');
})();

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
  bumpDataVersion();
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
  bumpDataVersion();
  return getCategory(id);
}
function removeCategory(id) { const ch = db.prepare('DELETE FROM categories WHERE id=?').run(id).changes > 0; if (ch) bumpDataVersion(); return ch; }

/* ============================ DISTRICTS ============================== */
function parseDistrict(r) { return r ? { id: r.id, slug: r.slug, name: r.name, display_order: r.display_order || 0, kind: districtKind(r.slug), zona: districtZona(r.slug) } : null; }
function listDistricts() { return db.prepare('SELECT * FROM districts ORDER BY display_order, name').all().map(parseDistrict); }
function getDistrict(id) { return parseDistrict(db.prepare('SELECT * FROM districts WHERE id=?').get(id)); }
function getDistrictBySlug(slug) { return parseDistrict(db.prepare('SELECT * FROM districts WHERE slug=?').get(String(slug || ''))); }
function countDistricts() { return db.prepare('SELECT COUNT(*) c FROM districts').get().c; }
function insertDistrict(name, slug, order) {
  const info = db.prepare('INSERT INTO districts (slug,name,display_order) VALUES (?,?,?)').run(slug || slugify(name), name, order || 0);
  bumpDataVersion();
  return getDistrict(Number(info.lastInsertRowid));
}
/* Distritos capitalei vs municipios ale Comunidad; zone geografice pentru navegación. */
function listDistritos() { return listDistricts().filter(d => d.kind === 'distrito'); }
function listMunicipios() { return listDistricts().filter(d => d.kind === 'municipio'); }
function listZones() {
  const munis = listMunicipios();
  return ZONES
    .map(z => ({ slug: z.slug, name: z.name, municipios: munis.filter(m => m.zona === z.slug) }))
    .filter(z => z.municipios.length);
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
  bumpDataVersion();
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
  bumpDataVersion();
  return getMetro(Number(info.lastInsertRowid));
}
function updateMetro(id, data) {
  const cur = getMetro(id);
  if (!cur) return null;
  const name = data.name != null ? String(data.name).trim() : cur.name;
  const slug = data.slug != null ? uniqueMetroSlug(slugify(data.slug), id) : cur.slug;
  const lines = 'lines' in data ? (Array.isArray(data.lines) ? data.lines : String(data.lines || '').split(/[,\s]+/).filter(Boolean)) : cur.lines;
  db.prepare('UPDATE metros SET name=?,slug=?,lines=? WHERE id=?').run(name, slug, JSON.stringify(lines), id);
  bumpDataVersion();
  return getMetro(id);
}
function removeMetro(id) { const ch = db.prepare('DELETE FROM metros WHERE id=?').run(id).changes > 0; if (ch) bumpDataVersion(); return ch; }

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
    logo: data.logo || null,
    photos: Array.isArray(data.photos) ? data.photos.filter(Boolean).map(String) : [],
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
    logo: r.logo || null, photos: safeParse(r.photos, []),
    district_id: r.district_id || null, neighborhood_id: r.neighborhood_id || null,
    created_at: r.created_at != null ? r.created_at : null,
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
  (id,name,address,about,district_id,neighborhood_id,phone,email,website,hours,social,rating,reviews,featured,photo,logo,photos,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const _updateBiz = db.prepare(`UPDATE businesses SET
  name=?,address=?,about=?,district_id=?,neighborhood_id=?,phone=?,email=?,website=?,hours=?,social=?,rating=?,reviews=?,featured=?,photo=?,logo=?,photos=?
  WHERE id=?`);

function insertBusiness(data, forcedId) {
  const b = normalizeBusiness(data);
  const id = forcedId || uniqueId(slugify(data.id || b.name));
  _insertBiz.run(id, b.name, b.address, b.about, b.districtId, b.neighborhoodId,
    b.phone, b.email, b.website, JSON.stringify(b.hours), JSON.stringify(b.social),
    b.rating, b.reviews, b.featured, b.photo, b.logo, JSON.stringify(b.photos), now());
  setBusinessCategories(id, b.categoryIds);
  setBusinessMetros(id, b.metroIds);
  bumpDataVersion();
  return getBusiness(id);
}
function businessToInput(b) {
  return {
    name: b.name, address: b.address, about: b.about, hours: b.hours, social: b.social,
    phone: b.phone, email: b.email, website: b.website, rating: b.rating, reviews: b.reviews,
    featured: b.featured, photo: b.photo, logo: b.logo, photos: b.photos,
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
    b.rating, b.reviews, b.featured, b.photo, b.logo, JSON.stringify(b.photos), id);
  setBusinessCategories(id, b.categoryIds);
  setBusinessMetros(id, b.metroIds);
  bumpDataVersion();
  return getBusiness(id);
}
function removeBusiness(id) { const ch = db.prepare('DELETE FROM businesses WHERE id=?').run(id).changes > 0; if (ch) bumpDataVersion(); return ch; }
function setFeatured(id, val) { db.prepare('UPDATE businesses SET featured=? WHERE id=?').run(val ? 1 : 0, id); bumpDataVersion(); return getBusiness(id); }
function getBusiness(id) { return attachRelations(parseBusinessRow(db.prepare('SELECT * FROM businesses WHERE id=?').get(id))); }
function countBusinesses() { return db.prepare('SELECT COUNT(*) c FROM businesses').get().c; }

/* Construiește query-ul (FROM/JOIN + WHERE + params) pentru un filtru de
   businesses. Partajat de calea „light" (id-uri) și cea „full" (cu relații).
   `dead=true` → niciun rezultat (slug inexistent). Filtrul de categorie e un
   JOIN (index pe business_categories.category_id) în loc de EXISTS peste toate
   cele 100k rânduri. Zona se rezolvă în SQL (district_id IN (…)). */
function buildBusinessQuery(filter) {
  filter = filter || {};
  const joins = [];
  const joinParams = [];
  const where = [];
  const whereParams = [];
  let dead = false, grouped = false;

  const catSlug = filter.categorySlug;
  const catId = filter.categoryId;
  if (catSlug || catId) {
    const cat = catSlug ? getCategoryBySlug(catSlug) : getCategory(catId);
    if (!cat) dead = true;
    else {
      const ids = descendantCategoryIds(cat.id);
      joins.push(`JOIN business_categories bc ON bc.business_id=b.id AND bc.category_id IN (${ids.map(() => '?').join(',')})`);
      joinParams.push(...ids);
      grouped = true;   // un negocio poate fi în părinte+copil → GROUP BY b.id evită dublurile
    }
  }
  let district = null;
  if (filter.districtSlug || filter.districtId) {
    district = filter.districtSlug ? getDistrictBySlug(filter.districtSlug) : getDistrict(filter.districtId);
    if (!district) dead = true;
    else { where.push('b.district_id=?'); whereParams.push(district.id); }
  }
  if (filter.barrioSlug || filter.neighborhoodId) {
    let n = null;
    if (filter.neighborhoodId) n = getNeighborhood(filter.neighborhoodId);
    else if (district) n = getNeighborhoodBySlug(district.id, filter.barrioSlug);
    if (!n) dead = true;
    else { where.push('b.neighborhood_id=?'); whereParams.push(n.id); }
  }
  if (filter.metroSlug || filter.metroId) {
    const m = filter.metroSlug ? getMetroBySlug(filter.metroSlug) : getMetro(filter.metroId);
    if (!m) dead = true;
    else { where.push('EXISTS (SELECT 1 FROM business_metros bm WHERE bm.business_id=b.id AND bm.metro_id=?)'); whereParams.push(m.id); }
  }
  if (filter.zona) {
    const ids = listDistricts().filter(d => d.zona === filter.zona).map(d => d.id);
    if (!ids.length) dead = true;
    else { where.push(`b.district_id IN (${ids.map(() => '?').join(',')})`); whereParams.push(...ids); }
  }
  if (filter.featured) where.push('b.featured=1');
  if (filter.q) {
    const like = '%' + String(filter.q).trim() + '%';
    where.push('(b.name LIKE ? OR b.about LIKE ? OR b.address LIKE ?)');
    whereParams.push(like, like, like);
  }
  // params în ordinea din SQL: întâi cele din JOIN, apoi cele din WHERE.
  return { joins: joins.join(' '), where, params: joinParams.concat(whereParams), dead, grouped };
}
function buildBusinessSql(cols, filter) {
  const { joins, where, params, dead, grouped } = buildBusinessQuery(filter);
  const sql = `SELECT ${cols} FROM businesses b ${joins} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ${grouped ? 'GROUP BY b.id' : ''} ORDER BY b.featured DESC, b.rating DESC, b.name ASC`;
  return { sql, params, dead };
}

/* Listare „light": DOAR câmpurile de bază, FĂRĂ relații și FĂRĂ parse de JSON.
   Suficient pentru ordonare (orderByContext) + paginare; paginile hidratează
   apoi doar cele ~20 de negocios afișate. La 100k rânduri asta e diferența
   dintre ~4 query-uri × 100k (câteva secunde) și un singur SELECT (ms). */
const LIGHT_COLS = 'b.id,b.name,b.featured,b.rating,b.district_id,b.neighborhood_id,b.created_at';
function listBusinessesLight(filter) {
  const { sql, params, dead } = buildBusinessSql(LIGHT_COLS, filter);
  if (dead) return [];
  const rows = db.prepare(sql).all(...params).map(r => ({
    id: r.id, name: r.name, featured: !!r.featured,
    rating: r.rating != null ? r.rating : null,
    district_id: r.district_id || null, neighborhood_id: r.neighborhood_id || null,
    created_at: r.created_at != null ? r.created_at : null,
  }));
  return (filter && filter.limit) ? rows.slice(0, filter.limit) : rows;
}

/* Listare „full" (cu relații atașate pe fiecare rând). Rămâne pentru export și
   board-ul de admin; NU o folosi pe paginile publice (e O(n) relații). */
function listBusinesses(filter) {
  const { sql, params, dead } = buildBusinessSql('b.*', filter);
  if (dead) return [];
  const out = db.prepare(sql).all(...params).map(r => attachRelations(parseBusinessRow(r)));
  return (filter && filter.limit) ? out.slice(0, filter.limit) : out;
}

/* Numărare + paginare la nivel de SQL (LIMIT/OFFSET), în ordinea implicită
   (featured/rating/name). Pentru API/admin: NU materializăm toate cele 100k
   rânduri ca să afișăm 50. (Fără shuffle pe context — ăla e pentru paginile SEO.) */
function countBusinessesFiltered(filter) {
  const { joins, where, params, dead, grouped } = buildBusinessQuery(filter);
  if (dead) return 0;
  const inner = `SELECT b.id FROM businesses b ${joins} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${grouped ? 'GROUP BY b.id' : ''}`;
  const sql = grouped ? `SELECT COUNT(*) c FROM (${inner})` : `SELECT COUNT(*) c FROM businesses b ${joins} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  return db.prepare(sql).get(...params).c;
}
function listBusinessesPageRows(filter, offset, limit) {
  const { joins, where, params, dead, grouped } = buildBusinessQuery(filter);
  if (dead) return [];
  const sql = `SELECT b.* FROM businesses b ${joins} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ${grouped ? 'GROUP BY b.id' : ''} ORDER BY b.featured DESC, b.rating DESC, b.name ASC LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(...params, Number(limit) || 50, Number(offset) || 0)
    .map(r => attachRelations(parseBusinessRow(r)));
}

/* Doar id + created_at, paginat la nivel de SQL — pentru sitemap-ul de negocios. */
function listBusinessSitemap(offset, limit) {
  return db.prepare('SELECT id, created_at FROM businesses ORDER BY created_at DESC, id LIMIT ? OFFSET ?')
    .all(Number(limit) || 45000, Number(offset) || 0);
}

/* Acoperire pentru sitemap: ce combinații (categorie × zonă/distrito/barrio/metro)
   au ≥1 negocio. Calculat prin câteva query-uri DISTINCT (mărginit de numărul de
   COMBINAȚII, nu de cele 100k negocios) — fără a materializa vreun rând întreg.
   Include și categoriile-strămoș (o subcategorie acoperă și pagina părintelui). */
function getSitemapCoverage() {
  const catById = new Map(db.prepare('SELECT id,slug,parent_id FROM categories').all().map(c => [c.id, c]));
  const distById = new Map(listDistricts().map(d => [d.id, d]));            // are slug + zona
  const barrById = new Map(db.prepare('SELECT id,slug FROM neighborhoods').all().map(n => [n.id, n]));
  const metroById = new Map(db.prepare('SELECT id,slug FROM metros').all().map(m => [m.id, m]));
  const ancSlugs = cid => {
    const out = []; let c = catById.get(cid), guard = 0;
    while (c && guard++ < 20) { out.push(c.slug); c = c.parent_id != null ? catById.get(c.parent_id) : null; }
    return out;
  };
  const cov = { muni: new Set(), cat: new Set(), catMun: new Set(), catBar: new Set(), catZona: new Set(), catMetro: new Set() };

  db.prepare('SELECT DISTINCT district_id d FROM businesses WHERE district_id IS NOT NULL').all()
    .forEach(r => { const d = distById.get(r.d); if (d) cov.muni.add(d.slug); });

  db.prepare('SELECT DISTINCT category_id c FROM business_categories').all()
    .forEach(r => ancSlugs(r.c).forEach(s => cov.cat.add(s)));

  db.prepare(`SELECT DISTINCT bc.category_id c, b.district_id d FROM business_categories bc
     JOIN businesses b ON b.id=bc.business_id WHERE b.district_id IS NOT NULL`).all()
    .forEach(r => { const d = distById.get(r.d); if (!d) return; ancSlugs(r.c).forEach(cs => { cov.catMun.add(cs + '|' + d.slug); if (d.zona) cov.catZona.add(cs + '|' + d.zona); }); });

  db.prepare(`SELECT DISTINCT bc.category_id c, b.district_id d, b.neighborhood_id n FROM business_categories bc
     JOIN businesses b ON b.id=bc.business_id WHERE b.neighborhood_id IS NOT NULL`).all()
    .forEach(r => { const d = distById.get(r.d), n = barrById.get(r.n); if (!d || !n) return; ancSlugs(r.c).forEach(cs => cov.catBar.add(cs + '|' + d.slug + '|' + n.slug)); });

  db.prepare(`SELECT DISTINCT bc.category_id c, bm.metro_id m FROM business_categories bc
     JOIN business_metros bm ON bm.business_id=bc.business_id`).all()
    .forEach(r => { const m = metroById.get(r.m); if (!m) return; ancSlugs(r.c).forEach(cs => cov.catMetro.add(cs + '|' + m.slug)); });

  return cov;
}

function replaceAll(items) {
  db.prepare('DELETE FROM businesses').run();  // cascade curăță tabelele de legătură
  bumpDataVersion();
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

/* ============================ PLACEMENTS ============================= */
/* Clasament manual per „context": home | cat:<slug> | cat:<slug>:zona:<z> |
   cat:<slug>:mun:<d>. Ordinea implicită e un shuffle determinist (hash), iar
   placement-urile trec peste el pentru contextul lor. */
const _delPlac = db.prepare('DELETE FROM placements WHERE context=?');
const _insPlac = db.prepare('INSERT OR REPLACE INTO placements (context, business_id, position) VALUES (?,?,?)');
const _existsBiz = db.prepare('SELECT 1 FROM businesses WHERE id=?');

function getPlacements(context) {
  return db.prepare('SELECT business_id, position FROM placements WHERE context=? ORDER BY position').all(String(context || ''));
}
function countPlacement(context) {
  return db.prepare('SELECT COUNT(*) c FROM placements WHERE context=?').get(String(context || '')).c;
}
function setPlacements(context, ids) {
  const ctx = String(context || '');
  db.exec('BEGIN');
  try {
    _delPlac.run(ctx);
    let pos = 0;
    (ids || []).forEach(id => { const sid = String(id); if (_existsBiz.get(sid)) _insPlac.run(ctx, sid, pos++); });
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch { /* ignoră */ } throw e; }
  bumpDataVersion();
  return getPlacements(ctx);
}
function clearPlacements(context) { const ch = _delPlac.run(String(context || '')).changes > 0; if (ch) bumpDataVersion(); return ch; }

/* Hash FNV-1a → cheie de sortare pseudo-aleatorie, stabilă per (business, context). */
function shuffleKey(id, context) {
  let h = 0x811c9dc5;
  const s = String(id) + '|' + String(context);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/* Ordonează o listă de businesses pentru un context: pinned (din placements) întâi
   în ordinea `position`, apoi restul după shuffle-ul determinist. */
function orderByContext(list, context) {
  const posMap = new Map(getPlacements(context).map(p => [p.business_id, p.position]));
  const pinned = [], rest = [];
  (list || []).forEach(b => { (posMap.has(b.id) ? pinned : rest).push(b); });
  pinned.sort((a, b) => posMap.get(a.id) - posMap.get(b.id));
  // decorate-sort: calculăm cheia de shuffle O(1) per item (nu de ~2× per
  // comparație), ca sortarea a 16k+ rânduri să nu re-hasheze de sute de mii de ori.
  rest.forEach(b => { b._sk = shuffleKey(b.id, context); });
  rest.sort((a, b) => (a._sk - b._sk) || (a.name < b.name ? -1 : 1));
  return pinned.concat(rest);
}
function paginate(items, page, pageSize) {
  const ps = pageSize || 20;
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / ps));
  const p = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
  return { items: items.slice((p - 1) * ps, p * ps), total, page: p, pages, pageSize: ps };
}
/* Cache de ORDINE per-context: lista ordonată de id-uri (ordonarea e deterministă
   și depinde doar de negocios + placements). La 10M vizite/lună traficul se
   concentrează pe puține pagini populare → aproape toate loviturile sunt din
   cache, iar un request devine „slice + hidratează 20", nu „sortează 16k".
   Invalidare simplă: un contor `_dataVersion` incrementat la ORICE scriere. */
let _dataVersion = 0;
function bumpDataVersion() { _dataVersion++; }
const _orderCache = new Map();        // context -> { ids:[], v }
const ORDER_CACHE_MAX = 300;
function orderedIdsForContext(context, baseFilter) {
  const hit = _orderCache.get(context);
  if (hit && hit.v === _dataVersion) return hit.ids;
  const ids = orderByContext(listBusinessesLight(baseFilter || {}), context).map(b => b.id);
  if (_orderCache.size >= ORDER_CACHE_MAX && !_orderCache.has(context)) {
    _orderCache.delete(_orderCache.keys().next().value);   // FIFO: scoate cel mai vechi
  }
  _orderCache.set(context, { ids, v: _dataVersion });
  return ids;
}
/* Listare ordonată pe context + paginare. Ordinea vine din cache (id-uri),
   apoi hidratăm cu relații DOAR negocios din pagina curentă (~20). */
function listForContext(context, baseFilter, opts) {
  opts = opts || {};
  const ids = orderedIdsForContext(context, baseFilter);
  const ps = opts.pageSize || 20;
  const total = ids.length;
  const pages = Math.max(1, Math.ceil(total / ps));
  const p = Math.min(Math.max(1, parseInt(opts.page, 10) || 1), pages);
  const items = ids.slice((p - 1) * ps, p * ps).map(id => getBusiness(id)).filter(Boolean);
  return { items, total, page: p, pages, pageSize: ps };
}
/* Home: doar membership (businesses din placements 'home'), în ordinea position. */
function listHome(opts) {
  opts = opts || {};
  const items = getPlacements('home').map(p => getBusiness(p.business_id)).filter(Boolean);
  return paginate(items, opts.page, opts.pageSize || 20);
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

/* ------------------------------- Leads -------------------------------- */
/* Cererile de presupuesto trimise de vizitatori — inima de business a
   directorului. Model IMPORTANT: pe producție (Supabase) lead-urile sunt
   append-only DIRECT în Postgres (vezi pgstore.insertLead/listLeads), NU trec
   prin snapshot-ul complet care se rescrie la fiecare salvare de admin — altfel
   o cursă între două instanțe serverless ar putea suprascrie un lead nou.
   Local (fără Postgres) trăiesc în SQLite. Toate funcțiile sunt async ca
   serverul să folosească un singur cod indiferent de backend. */
const LEAD_STATUSES = ['new', 'contacted', 'archived'];
function newLeadId() { return now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
function normalizeLead(data) {
  data = data || {};
  const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  return {
    business_id: data.businessId || data.business_id ? String(data.businessId || data.business_id).slice(0, 80) : null,
    name: cut(data.name, 120),
    phone: cut(data.phone, 40),
    email: cut(data.email, 160),
    message: cut(data.message, 2000),
    context: cut(data.context, 200),
    source_url: cut(data.sourceUrl || data.source_url, 400),
  };
}
function parseLeadRow(r) {
  if (!r) return null;
  const bizName = r.business_name != null ? r.business_name
    : (r.business_id ? (db.prepare('SELECT name FROM businesses WHERE id=?').get(r.business_id) || {}).name : null);
  return {
    id: r.id, business_id: r.business_id || null, businessName: bizName || null,
    name: r.name, phone: r.phone || '', email: r.email || '', message: r.message || '',
    context: r.context || '', source_url: r.source_url || '',
    status: r.status || 'new', created_at: Number(r.created_at) || 0,
  };
}
const _insLeadLocal = db.prepare(`INSERT INTO leads (id,business_id,name,phone,email,message,context,source_url,status,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);
function getLeadLocal(id) { return parseLeadRow(db.prepare('SELECT * FROM leads WHERE id=?').get(String(id))); }
function listLeadsLocal(filter) {
  filter = filter || {};
  const where = [], params = [];
  if (filter.status && LEAD_STATUSES.includes(filter.status)) { where.push('status=?'); params.push(filter.status); }
  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC`;
  return db.prepare(sql).all(...params).map(parseLeadRow);
}

/* Creează un lead. Returnează obiectul salvat. */
async function createLead(data) {
  const L = normalizeLead(data);
  const row = { id: newLeadId(), business_id: L.business_id, name: L.name, phone: L.phone,
    email: L.email, message: L.message, context: L.context, source_url: L.source_url,
    status: 'new', created_at: now() };
  if (pgstore.isEnabled()) { await pgstore.insertLead(row); return parseLeadRow(row); }
  _insLeadLocal.run(row.id, row.business_id, row.name, row.phone, row.email, row.message, row.context, row.source_url, row.status, row.created_at);
  return getLeadLocal(row.id);
}
async function getLeads(filter) {
  filter = filter || {};
  if (filter.status && !LEAD_STATUSES.includes(filter.status)) filter = Object.assign({}, filter, { status: null });
  if (pgstore.isEnabled()) return (await pgstore.listLeads(filter)).map(parseLeadRow);
  return listLeadsLocal(filter);
}
/* Contoare per status pentru badge-ul din admin: { new, contacted, archived, total }. */
async function getLeadCounts() {
  let rows;
  if (pgstore.isEnabled()) rows = await pgstore.countLeadsByStatus();
  else rows = db.prepare('SELECT status, COUNT(*) c FROM leads GROUP BY status').all();
  const out = { new: 0, contacted: 0, archived: 0, total: 0 };
  (rows || []).forEach(r => { const c = Number(r.c) || 0; if (out[r.status] != null) out[r.status] = c; out.total += c; });
  return out;
}
async function setLeadStatus(id, status) {
  if (!LEAD_STATUSES.includes(String(status))) return null;
  if (pgstore.isEnabled()) { const r = await pgstore.updateLeadStatus(String(id), String(status)); return r ? parseLeadRow(r) : null; }
  const info = db.prepare('UPDATE leads SET status=? WHERE id=?').run(String(status), String(id));
  return info.changes ? getLeadLocal(id) : null;
}
async function deleteLead(id) {
  if (pgstore.isEnabled()) return pgstore.deleteLead(String(id));
  return db.prepare('DELETE FROM leads WHERE id=?').run(String(id)).changes > 0;
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
/* Rescrie COMPLET starea în Postgres (full dump). Scump la scară → îl folosim
   DOAR pentru operații în masă (import / reset-demo). Pentru scrierile punctuale
   folosim funcțiile persist* incrementale de mai jos. */
async function persist() {
  if (!pgstore.isEnabled()) return;
  await pgstore.dump(db);
}
function persistenceEnabled() { return pgstore.isEnabled(); }

/* ---- Persistență INCREMENTALĂ (o singură entitate → un singur upsert) --------
   Fără astea, orice editare de admin (sau fiecare negocio împins din CRM) ar
   rescrie toată baza în Postgres — O(n) per scriere, O(n²) la un import 1-câte-1. */
async function persistBusiness(id) {
  if (!pgstore.isEnabled()) return;
  const cols = pgstore.TABLES.businesses;
  const row = db.prepare(`SELECT ${cols.join(',')} FROM businesses WHERE id=?`).get(id);
  if (!row) return;
  const catIds = db.prepare('SELECT category_id FROM business_categories WHERE business_id=?').all(id).map(r => r.category_id);
  const metroIds = db.prepare('SELECT metro_id FROM business_metros WHERE business_id=?').all(id).map(r => r.metro_id);
  await pgstore.upsertBusiness(row, catIds, metroIds);
}
async function persistBusinessDelete(id) {
  if (!pgstore.isEnabled()) return;
  await pgstore.deleteBusiness(String(id));
}
async function persistCategory(id) {
  if (!pgstore.isEnabled()) return;
  const cols = pgstore.TABLES.categories;
  const row = db.prepare(`SELECT ${cols.join(',')} FROM categories WHERE id=?`).get(id);
  if (row) await pgstore.upsertRow('categories', row);
}
/* Ștergere de categorie: cascadă și în Postgres (n-are FK) — id + descendenți +
   legăturile din business_categories. `ids` = [id, ...descendenți] capturat de
   apelant ÎNAINTE de removeCategory (SQLite cascadează, deci după nu mai știm). */
async function persistCategoryDelete(ids) {
  if (!pgstore.isEnabled()) return;
  const arr = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  await pgstore.deleteRowsIn('business_categories', 'category_id', arr);
  await pgstore.deleteRowsIn('categories', 'id', arr);
}
async function persistMetro(id) {
  if (!pgstore.isEnabled()) return;
  const cols = pgstore.TABLES.metros;
  const row = db.prepare(`SELECT ${cols.join(',')} FROM metros WHERE id=?`).get(id);
  if (row) await pgstore.upsertRow('metros', row);
}
async function persistMetroDelete(id) {
  if (!pgstore.isEnabled()) return;
  await pgstore.deleteRowsIn('business_metros', 'metro_id', [Number(id)]);
  await pgstore.deleteRowsIn('metros', 'id', [Number(id)]);
}
async function persistNeighborhood(id) {
  if (!pgstore.isEnabled()) return;
  const cols = pgstore.TABLES.neighborhoods;
  const row = db.prepare(`SELECT ${cols.join(',')} FROM neighborhoods WHERE id=?`).get(id);
  if (row) await pgstore.upsertRow('neighborhoods', row);
}
async function persistPlacements(context) {
  if (!pgstore.isEnabled()) return;
  const rows = db.prepare('SELECT context,business_id,position FROM placements WHERE context=?').all(String(context));
  await pgstore.replacePlacements(String(context), rows);
}

module.exports = {
  db, DAYS, slugify, now,
  initPersistence, persist, persistenceEnabled,
  persistBusiness, persistBusinessDelete, persistCategory, persistCategoryDelete,
  persistMetro, persistMetroDelete, persistNeighborhood, persistPlacements,
  // categories
  listCategories, getCategoryTree, getCategory, getCategoryBySlug, insertCategory, updateCategory, removeCategory, descendantCategoryIds, countCategories,
  // districts / neighborhoods / zonas
  listDistricts, getDistrict, getDistrictBySlug, countDistricts, insertDistrict,
  listDistritos, listMunicipios, listZones, ZONES,
  listNeighborhoods, getNeighborhood, getNeighborhoodBySlug, insertNeighborhood,
  // metros
  listMetros, getMetro, getMetroBySlug, insertMetro, updateMetro, removeMetro, countMetros,
  // businesses
  insertBusiness, updateBusiness, removeBusiness, setFeatured, getBusiness, listBusinesses, listBusinessesLight, countBusinesses, replaceAll,
  countBusinessesFiltered, listBusinessesPageRows,
  // sitemap
  listBusinessSitemap, getSitemapCoverage,
  // placements / clasament
  getPlacements, setPlacements, clearPlacements, countPlacement, orderByContext, listForContext, listHome,
  // events / stats
  recordEvent, countEvents, clearEvents, getStats, getMonthlySeries,
  // leads
  createLead, getLeads, getLeadCounts, setLeadStatus, deleteLead, LEAD_STATUSES,
};
