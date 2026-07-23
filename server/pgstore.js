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
  businesses:          ['id', 'name', 'address', 'about', 'district_id', 'neighborhood_id', 'phone', 'email', 'website', 'hours', 'social', 'rating', 'reviews', 'featured', 'photo', 'logo', 'photos', 'created_at'],
  business_categories: ['business_id', 'category_id'],
  business_metros:     ['business_id', 'metro_id'],
  placements:          ['context', 'business_id', 'position'],
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
  featured INTEGER DEFAULT 0, photo TEXT, logo TEXT, photos TEXT, created_at BIGINT
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
`;

/* Coloane adăugate ulterior — Postgres CREATE TABLE IF NOT EXISTS nu le adaugă
   pe un tabel existent, deci le migrăm explicit în ensureSchema(). */
const ALTERS = [
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo TEXT`,
  `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS photos TEXT`,
];

let pool = null;
let enabled = false;

/* Creează pool-ul pg din DATABASE_URL, sau folosește unul injectat (test). */
function init(injectedPool) {
  if (injectedPool) { pool = injectedPool; enabled = true; return true; }
  const url = process.env.DATABASE_URL;
  if (!url) { enabled = false; return false; }
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: url,
    // Supabase cere SSL; pe pooler-ul lor certificatul e gestionat de ei.
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 1),   // serverless: puține conexiuni
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
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

/* Încarcă tot conținutul din Postgres în SQLite-ul in-memory.
   Returnează numărul total de rânduri (0 → Postgres e gol, trebuie seed). */
async function hydrate(sqlite) {
  if (!enabled) return 0;
  let total = 0;
  for (const table of TABLE_NAMES) {
    const cols = TABLES[table];
    const { rows } = await pool.query(`SELECT ${cols.join(',')} FROM ${table}`);
    if (!rows.length) continue;
    const placeholders = cols.map(() => '?').join(',');
    const stmt = sqlite.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
    for (const r of rows) {
      stmt.run(...cols.map(c => normalizeForSqlite(r[c])));
      total++;
    }
  }
  return total;
}

/* Rescrie complet starea din SQLite în Postgres (conținut administrat).
   Apelat după fiecare scriere de admin — dataset mic, deci e ieftin. */
async function dump(sqlite) {
  if (!enabled) return;
  const snapshot = {};
  for (const table of TABLE_NAMES) {
    snapshot[table] = sqlite.prepare(`SELECT ${TABLES[table].join(',')} FROM ${table}`).all();
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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

module.exports = { init, isEnabled, ensureSchema, hydrate, dump, TABLES, TABLE_NAMES, DDL };
