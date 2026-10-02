/* =========================================================================
   pgstore.js — Persistență durabilă în Supabase Postgres.

   Model: baza de lucru rămâne SQLite `:memory:` (toată logica din db.js e
   neschimbată, sincronă). Postgres e sursa durabilă, partajată între
   instanțele serverless (Vercel):
     • init()     → creează pool-ul pg (sau primește unul injectat la test)
     • ensureSchema() → CREATE TABLE IF NOT EXISTS în Postgres
     • hydrate(sqlite) → încarcă rândurile din Postgres în SQLite la boot
     • dump(sqlite)    → rescrie starea curentă din SQLite în Postgres (după
                          fiecare scriere de admin)

   Evenimentele de analytics NU se persistă aici (rămân în memorie per
   instanță) — pe serverless nu vrem un INSERT în DB la fiecare vizită.
   ========================================================================= */
'use strict';

/* Tabelele de conținut administrat, în ordinea de inserare (părinți întâi). */
const TABLES = {
  districts:           ['id', 'slug', 'name', 'display_order'],
  categories:          ['id', 'slug', 'name', 'parent_id', 'icon', 'intro', 'display_order', 'in_nav'],
  neighborhoods:       ['id', 'slug', 'name', 'district_id'],
  metros:              ['id', 'slug', 'name', 'lines'],
  businesses:          ['id', 'name', 'address', 'about', 'district_id', 'neighborhood_id', 'phone', 'email', 'website', 'hours', 'social', 'rating', 'reviews', 'featured', 'photo', 'logo', 'photos', 'area', 'contact_name', 'team_size', 'claimed', 'claimed_at', 'created_at'],
  business_categories: ['business_id', 'category_id'],
  business_metros:     ['business_id', 'metro_id'],
  placements:          ['context', 'business_id', 'position'],
  stories:             ['id', 'business_id', 'title', 'excerpt', 'body', 'cover', 'photos', 'status', 'sponsored', 'consent_at', 'published_at', 'updated_at', 'created_at'],
};
const TABLE_NAMES = Object.keys(TABLES);

/* DDL Postgres — tipuri simple, oglindesc SQLite (JSON păstrat ca TEXT,
   booleeni ca INTEGER 0/1). Fără FK: golim tot cu TRUNCATE și reinserăm. */
const DDL = `
CREATE TABLE IF NOT EXISTS districts (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, display_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, parent_id INTEGER,
  icon TEXT, intro TEXT, display_order INTEGER DEFAULT 0, in_nav INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS neighborhoods (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, district_id INTEGER
);
CREATE TABLE IF NOT EXISTS metros (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, lines TEXT
);
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, about TEXT,
  district_id INTEGER, neighborhood_id INTEGER, phone TEXT, email TEXT, website TEXT,
  hours TEXT, social TEXT, rating DOUBLE PRECISION, reviews INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0, photo TEXT, logo TEXT, photos TEXT,
  area TEXT, contact_name TEXT, team_size INTEGER, claimed INTEGER DEFAULT 0, claimed_at BIGINT,
  created_at BIGINT
);
CREATE TABLE IF NOT EXISTS business_categories (
  business_id TEXT NOT NULL, category_id INTEGER NOT NULL, PRIMARY KEY (business_id, category_id)
);
CREATE TABLE IF NOT EXISTS business_metros (
  business_id TEXT NOT NULL, metro_id INTEGER NOT NULL, PRIMARY KEY (business_id, metro_id)
);
CREATE TABLE IF NOT EXISTS placements (
  context TEXT NOT NULL, business_id TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (context, business_id)
);
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY, business_id TEXT, name TEXT NOT NULL, phone TEXT, email TEXT,
  message TEXT, context TEXT, source_url TEXT, status TEXT NOT NULL DEFAULT 'new',
  kind TEXT NOT NULL DEFAULT 'quote', payload TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at DESC);
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY, business_id TEXT, title TEXT NOT NULL, excerpt TEXT, body TEXT, cover TEXT, photos TEXT,
  status TEXT NOT NULL DEFAULT 'draft', sponsored INTEGER DEFAULT 0, consent_at BIGINT, published_at BIGINT,
  updated_at BIGINT, created_at BIGINT
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, value TEXT
);
`;

/* Coloane adăugate ulterior — Postgres CREATE TABLE IF NOT EXISTS nu le adaugă
   pe un tabel existent, deci le migrăm explicit în ensureSchema(). */
const ALTERS = [
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo TEXT`,
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS photos TEXT`,
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS area TEXT`,
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_name TEXT`,
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS team_size INTEGER`,
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS claimed INTEGER DEFAULT 0`,
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS claimed_at BIGINT`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'quote'`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS payload TEXT`,
];

let pool = null;
let enabled = false;

/* Versiunea datelor („meta.data_version"): fiecare scriere o schimbă, iar fiecare
   instanță serverless o compară periodic cu versiunea pe care a încărcat-o →
   dacă altă instanță (sau scriptul de import) a modificat ceva, se reîncarcă.
   Fără asta, o instanță „caldă" ar servi date vechi până la reciclare. */
let lastSeenVersion = null;
let staleHint = false;
async function getVersion(q) {
  const { rows } = await (q || pool).query("SELECT value FROM meta WHERE key='data_version'");
  return rows[0] ? rows[0].value : null;
}
async function bumpVersion(q) {
  q = q || pool;
  const prev = await getVersion(q);
  const v = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  await q.query("INSERT INTO meta (key,value) VALUES ('data_version',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [v]);
  if (prev !== lastSeenVersion) staleHint = true;   // altcineva a scris între timp → reîncarcă la următoarea verificare
  lastSeenVersion = v;
}
async function isStale() {
  if (!enabled) return false;
  return staleHint || (await getVersion()) !== lastSeenVersion;
}

/* Creează pool-ul pg din DATABASE_URL, sau folosește unul injectat (test). */
function init(injectedPool) {
  if (injectedPool) { pool = injectedPool; enabled = true; return true; }
  if (pool) return enabled;   // reîncercare după un eșec: refolosim pool-ul
  const url = process.env.DATABASE_URL;
  if (!url) { enabled = false; return false; }
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: url,
    // Supabase cere SSL; pe pooler-ul lor certificatul e gestionat de ei.
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 1),   // serverless: puține conexiuni
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  enabled = true;
  return true;
}
function isEnabled() { return enabled; }

async function ensureSchema() {
  if (!enabled) return;
  // Rulăm fiecare CREATE separat (compatibil și cu pooler-ul, și cu pg-mem).
  for (const stmt of DDL.split(';').map(s => s.trim()).filter(Boolean)) {
    await pool.query(stmt);
  }
  // Migrări de coloane pe tabele deja existente (idempotente).
  for (const stmt of ALTERS) {
    try { await pool.query(stmt); } catch (e) { console.error('⚠️  ALTER Postgres:', e.message); }
  }
}

/* Citește tot conținutul din Postgres (async). Versiunea e citită ÎNAINTE de
   date: o scriere concurentă duce cel mult la încă o reîncărcare, nu la pierderi. */
async function fetchSnapshot() {
  const version = await getVersion();
  const tables = {};
  for (const table of TABLE_NAMES) {
    tables[table] = (await pool.query(`SELECT ${TABLES[table].join(',')} FROM ${table}`)).rows;
  }
  return { version, tables };
}
/* Scrie snapshot-ul în SQLite SINCRON (fără await) → nicio cerere nu vede o
   bază pe jumătate încărcată. `clear` = golește întâi (reîncărcare). FK oprite pe
   durata încărcării: Postgres n-are FK, deci un rând orfan nu blochează tot. */
function loadSnapshot(sqlite, snap, clear) {
  let total = 0;
  sqlite.exec('PRAGMA foreign_keys = OFF');
  sqlite.exec('BEGIN');
  try {
    if (clear) [...TABLE_NAMES].reverse().forEach(t => sqlite.exec(`DELETE FROM ${t}`));
    for (const table of TABLE_NAMES) {
      const cols = TABLES[table];
      const stmt = sqlite.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
      for (const r of snap.tables[table]) { stmt.run(...cols.map(c => normalizeForSqlite(r[c]))); total++; }
    }
    sqlite.exec('COMMIT');
  } catch (e) { try { sqlite.exec('ROLLBACK'); } catch { /* ignoră */ } throw e; }
  finally { sqlite.exec('PRAGMA foreign_keys = ON'); }
  lastSeenVersion = snap.version;
  staleHint = false;
  return total;
}
/* Încarcă tot conținutul din Postgres în SQLite-ul in-memory.
   Returnează numărul total de rânduri (0 → Postgres e gol, trebuie seed). */
async function hydrate(sqlite) {
  if (!enabled) return 0;
  return loadSnapshot(sqlite, await fetchSnapshot(), false);
}

/* Rescrie complet starea din SQLite în Postgres (conținut administrat).
   Doar pentru operații în masă (seed pe bază goală, import, reset-demo).
   Plasă de siguranță: refuză să înlocuiască o bază cu multe negocios printr-un
   snapshot mult mai mic (ex. o instanță care a pornit doar cu datele demo),
   în afară de cazul `allowShrink` (acțiune explicită de admin). */
async function dump(sqlite, opts) {
  if (!enabled) return;
  opts = opts || {};
  const snapshot = {};
  for (const table of TABLE_NAMES) {
    snapshot[table] = sqlite.prepare(`SELECT ${TABLES[table].join(',')} FROM ${table}`).all();
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!opts.allowShrink) {
      const pgCount = Number((await client.query('SELECT COUNT(*) AS c FROM businesses')).rows[0].c) || 0;
      const n = snapshot.businesses.length;
      if (pgCount >= 50 && n < pgCount / 2) {
        throw new Error(`Refuz să suprascriu ${pgCount} negocios din Postgres cu doar ${n} (snapshot incomplet).`);
      }
    }
    // Golim fiecare tabel (PK-uri explicite → fără RESTART IDENTITY).
    for (const table of TABLE_NAMES) await client.query(`DELETE FROM ${table}`);
    for (const table of TABLE_NAMES) {
      const rows = snapshot[table];
      if (!rows.length) continue;
      const cols = TABLES[table];
      // Inserare pe loturi (max ~1000 rânduri/lot ca să nu depășim limitele).
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK);
        const values = [];
        const params = [];
        let p = 1;
        for (const r of batch) {
          values.push('(' + cols.map(() => '$' + (p++)).join(',') + ')');
          params.push(...cols.map(c => r[c] === undefined ? null : r[c]));
        }
        await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')}`, params);
      }
    }
    await bumpVersion(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ---- Scrieri INCREMENTALE (o entitate, nu tot snapshot-ul) ------------------
   Cheile primare per tabel, pentru ON CONFLICT. */
const PK = {
  districts: ['id'], categories: ['id'], neighborhoods: ['id'], metros: ['id'],
  businesses: ['id'],
  business_categories: ['business_id', 'category_id'],
  business_metros: ['business_id', 'metro_id'],
  placements: ['context', 'business_id'],
  stories: ['id'],
};
function upsertSql(table, cols, pkCols) {
  const ph = cols.map((_, i) => '$' + (i + 1)).join(',');
  const updates = cols.filter(c => !pkCols.includes(c)).map(c => `${c}=EXCLUDED.${c}`).join(',');
  const conflict = updates
    ? `ON CONFLICT (${pkCols.join(',')}) DO UPDATE SET ${updates}`
    : `ON CONFLICT (${pkCols.join(',')}) DO NOTHING`;
  return `INSERT INTO ${table} (${cols.join(',')}) VALUES (${ph}) ${conflict}`;
}

/* Upsert un negocio + rescrie DOAR legăturile lui (categorii/metros). */
async function upsertBusiness(row, categoryIds, metroIds) {
  if (!enabled) return;
  const cols = TABLES.businesses;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(upsertSql('businesses', cols, PK.businesses), cols.map(c => row[c] === undefined ? null : row[c]));
    await client.query('DELETE FROM business_categories WHERE business_id=$1', [row.id]);
    for (const cid of (categoryIds || [])) {
      await client.query('INSERT INTO business_categories (business_id,category_id) VALUES ($1,$2) ON CONFLICT (business_id,category_id) DO NOTHING', [row.id, cid]);
    }
    await client.query('DELETE FROM business_metros WHERE business_id=$1', [row.id]);
    for (const mid of (metroIds || [])) {
      await client.query('INSERT INTO business_metros (business_id,metro_id) VALUES ($1,$2) ON CONFLICT (business_id,metro_id) DO NOTHING', [row.id, mid]);
    }
    await bumpVersion(client);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
async function deleteBusiness(id) {
  if (!enabled) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM business_categories WHERE business_id=$1', [id]);
    await client.query('DELETE FROM business_metros WHERE business_id=$1', [id]);
    await client.query('DELETE FROM placements WHERE business_id=$1', [id]);
    await client.query('DELETE FROM businesses WHERE id=$1', [id]);
    await bumpVersion(client);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
/* Upsert pe loturi (fără ștergeri) — pentru taxonomie adăugată la boot. */
async function upsertRows(table, rows) {
  if (!enabled || !rows || !rows.length) return;
  const cols = TABLES[table], pk = PK[table];
  const updates = cols.filter(c => !pk.includes(c)).map(c => `${c}=EXCLUDED.${c}`).join(',');
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200), params = [];
    let p = 1;
    const values = batch.map(r => { params.push(...cols.map(c => r[c] === undefined ? null : r[c])); return '(' + cols.map(() => '$' + (p++)).join(',') + ')'; });
    await pool.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')} ON CONFLICT (${pk.join(',')}) DO ${updates ? 'UPDATE SET ' + updates : 'NOTHING'}`, params);
  }
  await bumpVersion();
}
/* Upsert generic pentru un rând de taxonomie (categories/metros/neighborhoods…). */
async function upsertRow(table, row) {
  if (!enabled) return;
  const cols = TABLES[table];
  await pool.query(upsertSql(table, cols, PK[table]), cols.map(c => row[c] === undefined ? null : row[c]));
  await bumpVersion();
}
async function deleteRowsIn(table, whereCol, vals) {
  if (!enabled || !vals || !vals.length) return;
  const ph = vals.map((_, i) => '$' + (i + 1)).join(',');
  await pool.query(`DELETE FROM ${table} WHERE ${whereCol} IN (${ph})`, vals);
  await bumpVersion();
}
/* Rescrie DOAR placement-urile unui context (mărginit — max câteva zeci de rânduri). */
async function replacePlacements(context, rows) {
  if (!enabled) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM placements WHERE context=$1', [context]);
    for (const r of (rows || [])) {
      await client.query('INSERT INTO placements (context,business_id,position) VALUES ($1,$2,$3) ON CONFLICT (context,business_id) DO UPDATE SET position=EXCLUDED.position', [context, r.business_id, r.position]);
    }
    await bumpVersion(client);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

/* pg poate întoarce boolean ca true/false și BIGINT ca string. SQLite vrea
   0/1 pentru booleeni; pentru coloanele INTEGER, afinitatea SQLite convertește
   singură textul numeric (ex. created_at „1721000000") — deci NU atingem
   string-urile (altfel un id de business numeric ar deveni număr). */
function normalizeForSqlite(v) {
  if (v === true) return 1;
  if (v === false) return 0;
  if (typeof v === 'bigint') return Number(v);
  return v;
}

/* ------------------------------- Leads -------------------------------- */
/* Append-only, INTENȚIONAT în afara snapshot-ului (dump/hydrate): scriere și
   citire directe în Postgres, ca un lead să nu poată fi suprascris de rescrierea
   completă a stării de la o altă instanță serverless. */
async function insertLead(row) {
  if (!enabled) return;
  await pool.query(
    `INSERT INTO leads (id,business_id,name,phone,email,message,context,source_url,status,kind,payload,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [row.id, row.business_id, row.name, row.phone, row.email, row.message, row.context, row.source_url, row.status, row.kind || 'quote', row.payload || null, row.created_at]);
}
async function getLead(id) {
  if (!enabled) return null;
  const { rows } = await pool.query(
    `SELECT l.*, b.name AS business_name FROM leads l LEFT JOIN businesses b ON b.id = l.business_id WHERE l.id = $1`, [id]);
  return rows[0] || null;
}
async function countNewLeadsByKind() {
  if (!enabled) return [];
  const { rows } = await pool.query(`SELECT kind, COUNT(*)::int AS c FROM leads WHERE status = 'new' GROUP BY kind`);
  return rows;
}
async function listLeads(filter) {
  if (!enabled) return [];
  filter = filter || {};
  const params = [], conds = [];
  if (filter.status) { params.push(filter.status); conds.push('l.status = $' + params.length); }
  if (filter.kind) { params.push(filter.kind); conds.push('l.kind = $' + params.length); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const { rows } = await pool.query(
    `SELECT l.*, b.name AS business_name FROM leads l
     LEFT JOIN businesses b ON b.id = l.business_id
     ${where} ORDER BY l.created_at DESC, l.id DESC LIMIT 500`, params);
  return rows;
}
async function countLeadsByStatus() {
  if (!enabled) return [];
  const { rows } = await pool.query('SELECT status, COUNT(*)::int AS c FROM leads GROUP BY status');
  return rows;
}
async function updateLeadStatus(id, status) {
  if (!enabled) return null;
  const { rows } = await pool.query('UPDATE leads SET status=$2 WHERE id=$1 RETURNING *', [id, status]);
  const r = rows[0];
  if (r && r.business_id) { const b = await pool.query('SELECT name FROM businesses WHERE id=$1', [r.business_id]); r.business_name = b.rows[0] ? b.rows[0].name : null; }
  return r || null;
}
async function deleteLead(id) {
  if (!enabled) return false;
  const r = await pool.query('DELETE FROM leads WHERE id=$1', [id]);
  return r.rowCount > 0;
}

module.exports = {
  init, isEnabled, ensureSchema, hydrate, dump, TABLES, TABLE_NAMES, DDL,
  fetchSnapshot, loadSnapshot, isStale, getVersion,
  upsertBusiness, deleteBusiness, upsertRow, upsertRows, deleteRowsIn, replacePlacements,
  insertLead, getLead, listLeads, countLeadsByStatus, countNewLeadsByKind, updateLeadStatus, deleteLead,
};
