-- =========================================================================
-- schema.sql — Structura tabelelor în Supabase Postgres.
--
-- NU e obligatoriu să rulezi manual acest fișier: aplicația creează singură
-- tabelele la primul boot (CREATE TABLE IF NOT EXISTS, vezi server/pgstore.js).
-- Îl păstrăm ca referință / pentru cine preferă să ruleze schema din
-- Supabase Dashboard → SQL Editor.
--
-- Model: SQLite `:memory:` e baza de lucru (logica din server/db.js), iar
-- Postgres e sursa durabilă partajată între instanțele serverless.
-- Booleeni stocați ca INTEGER 0/1; câmpurile JSON (lines/hours/social) ca TEXT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS districts (
  id            INTEGER PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id            INTEGER PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  parent_id     INTEGER,
  icon          TEXT,
  intro         TEXT,
  display_order INTEGER DEFAULT 0,
  in_nav        INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS neighborhoods (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  district_id INTEGER
);

CREATE TABLE IF NOT EXISTS metros (
  id    INTEGER PRIMARY KEY,
  slug  TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL,
  lines TEXT
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
  hours           TEXT,
  social          TEXT,
  rating          DOUBLE PRECISION,
  reviews         INTEGER DEFAULT 0,
  featured        INTEGER DEFAULT 0,
  photo           TEXT,
  created_at      BIGINT
);

CREATE TABLE IF NOT EXISTS business_categories (
  business_id TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (business_id, category_id)
);

CREATE TABLE IF NOT EXISTS business_metros (
  business_id TEXT NOT NULL,
  metro_id    INTEGER NOT NULL,
  PRIMARY KEY (business_id, metro_id)
);
