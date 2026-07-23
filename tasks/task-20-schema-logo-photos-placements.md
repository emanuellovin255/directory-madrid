# Task 20 — Schema: logo + galerie foto + tabel `placements` ✅

**Status:** ✅ Gata · **Faza 4 (clasament + poze)**

## Obiectiv
Extinde modelul de date ca fiecare negocio să aibă **logo** + **galerie de poze de servicii**, și
adaugă un tabel nou `placements` care ține **clasamentul manual per context** (home / nișă / nișă×zonă /
nișă×municipiu). Totul persistat în lockstep cu Supabase Postgres.

## Implementat
- **`server/db.js`**
  - `businesses`: coloane noi `logo TEXT`, `photos TEXT` (JSON array de URL-uri).
  - Tabel nou `placements(context TEXT, business_id TEXT, position INTEGER, PK(context,business_id))`
    cu FK `ON DELETE CASCADE` și index `(context, position)`.
  - **Migrare SQLite idempotentă**: pe un `data.db` vechi, `PRAGMA table_info(businesses)` + `ALTER TABLE
    ADD COLUMN` pentru `logo`/`photos` (nu se pierd datele).
  - `normalizeBusiness` / `parseBusinessRow` / `businessToInput` + prepared statements `_insertBiz`/
    `_updateBiz` extinse cu `logo`, `photos` (JSON.stringify/safeParse).
  - Funcții noi: `getPlacements`, `setPlacements` (tranzacție BEGIN/COMMIT, poziții 0..n-1),
    `clearPlacements`, `countPlacement`, `orderByContext` (shuffle determinist FNV-1a + pinned-first),
    `paginate`, `listForContext`, `listHome`.
- **`server/pgstore.js`**
  - `TABLES.businesses` += `logo`, `photos`; `TABLES.placements` nou.
  - `DDL` += coloane pe `businesses` + `CREATE TABLE placements`.
  - `ensureSchema()` rulează `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo/photos` (Postgres nu
    adaugă coloane la un tabel existent doar cu `CREATE TABLE IF NOT EXISTS`).
- **`db/schema.sql`** — oglindește schema (referință).

## Principiu „random" (compatibil SEO)
Ordinea implicită per context = **shuffle determinist** `hash(business_id + '|' + context)` → HTML
identic la fiecare request (bun pentru SEO/cache), arată aleatoriu, diferă de la o pagină la alta.
Placement-urile manuale trec peste shuffle doar pentru contextul lor.

## Verificat
`node -e` pe db.js: schema + migrare rulează fără erori; `setPlacements`/`getPlacements`/`clearPlacements`
funcționează; `listForContext`/`listHome` întorc `{items,total,page,pages,pageSize}`.
