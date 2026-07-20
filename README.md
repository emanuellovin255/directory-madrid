# Reformas Madrid

Un **director web SEO-first pentru contractori și servicii pentru casă din Madrid** — fontaneros, electricistas, cerrajeros, climatización și reformas. Modern, profesional și **complet full-stack**, cu **pagini generate pe server (SSR)** optimizate pentru Google.

**Stack:** Node.js + Express + **SQLite** (`node:sqlite`, built-in — fără dependențe native). Conținut în spaniolă.

> ⚠️ Negociile incluse sunt **demo/fictive** (telefoane/email/web `example`), în zone reale din Madrid. Le editezi/înlocuiești din panoul de admin.

---

## 🚀 Cum îl rulezi

Ai nevoie de **Node.js 22+**. Din folderul proiectului:

```bash
npm install      # o singură dată
npm start        # pornește serverul  (sau: npm run dev — reload automat)
```

Apoi deschide **http://localhost:3000**

- Site public (SSR): `http://localhost:3000/`
- Login admin: `http://localhost:3000/login.html`
- Panou admin: `http://localhost:3000/admin.html`

---

## 🔎 URL-uri SEO (inima proiectului)

Toate paginile de listare sunt **randate pe server** cu `<title>`/meta/canonical/H1/JSON-LD unice și internal linking dens:

| Pattern | Exemplu | Ce e |
|---|---|---|
| `/:categoria` | `/fontaneros` | Toți fontanerii din Madrid + linkuri către distritos |
| `/:categoria/:distrito` | `/fontaneros/salamanca` | Categorie într-un distrito + linkuri către barrios |
| `/:categoria/:distrito/:barrio` | `/fontaneros/salamanca/goya` | Firme într-un barrio (pagina „bani") |
| `/:categoria/metro/:estacion` | `/fontaneros/metro/cuatro-caminos` | Categorie lângă o stație de metrou |
| `/zona/:distrito[/:barrio]` | `/zona/salamanca` | Toate serviciile dintr-o zonă |
| `/metro` · `/metro/:estacion` | `/metro/sol` | Căutare / hub pe stații de metrou |
| `/negocio/:id` | `/negocio/aquafix-fontaneros-madrid` | Fișă proprie, indexabilă, per firmă |
| `/buscar?q=…` · `/sitemap.xml` · `/robots.txt` | — | Căutare + sitemap generat automat |

Căutarea din hero (serviciu + distrito + barrio + metrou) **rutează direct** la pagina SEO corespunzătoare.

---

## 🗂️ Taxonomie

- **Categorías + subcategorías** (Reformas, Fontaneros, Electricistas, Climatización, Cerrajeros …) — editabile din admin.
- **Distritos + barrios** — cele 21 distritos oficiale și barrios din `server/data/madrid-geo.json`.
- **Estaciones de metro** — set curat de stații-cheie, extensibil din admin.
- O firmă poate avea **mai multe categorii** și **mai multe stații de metrou** (tabele de legătură).

---

## 🛠️ Ce poți face din admin

- **Negocios**: adaugă / editează / șterge firme cu **selectoare structurate** — distrito → barrio (în cascadă), categorii/subcategorii (checklist), metrou (multi-select) — plus foto, „sobre", orar, contact, rețele sociale, valorare, destacado.
- **Taxonomía**: **adaugi/editezi/ștergi categorii și subcategorii** („adaugi un serviciu când vrei"), gestionezi stațiile de metrou, adaugi barrios.
- **Importar desde URL**: dai URL-ul unei firme; serverul **crawlează site-ul (fără AI)** și pre-completează formularul, **ghicind distrito/barrio și categoriile**; tu confirmi zona și subcategoria înainte de a salva.
- **Exportar / Importar** JSON, **Restaurar demo**, **Estadísticas** (vizite/lună, fișe văzute, clicuri de contact, top firme).

Login real (cookie de sesiune semnat); toate rutele de scriere sunt protejate pe server.

---

## 📁 Structura

```
Directory/
├── server/
│   ├── server.js     # Express: rute SSR (SEO) + API + auth + upload + analytics
│   ├── render.js     # SSR cu template literals (home/categorie/distrito/barrio/metro/ficha/sitemap)
│   ├── db.js         # SQLite: schema (taxonomie + businesses) + queries + agregări
│   ├── extract.js    # Import din URL: crawler same-origin + extractor determinist (fără AI)
│   ├── seed.js       # Seed la prima pornire: geo + categorii + metrou + firme demo
│   └── data/madrid-geo.json   # 21 distritos + barrios oficiale
├── public/
│   ├── login.html · admin.html
│   └── assets/{css,js}   # js/ ui.js · api.js · site.js · admin.js  ·  img/hero-madrid.svg
├── uploads/          # Poze încărcate (în .gitignore)
├── .env.example · package.json · README.md · tasks/
```

## 🌐 API (pe scurt)

| Metodă | Rută | Acces |
|--------|------|-------|
| GET | `/api/businesses`, `/api/businesses/:id` | public |
| POST/PUT/DELETE | `/api/businesses[/:id]` · `/featured` · `/reset-demo` | admin |
| GET | `/api/categories` · `/api/districts` · `/api/districts/:id/neighborhoods` · `/api/metros` | public |
| POST/PUT/DELETE | `/api/categories[/:id]` · `/api/metros[/:id]` · `/api/neighborhoods` | admin |
| POST | `/api/upload` · `/api/extract` · `/api/import` · GET `/api/export` | admin |
| POST | `/api/auth/login` · `/logout` · GET `/api/auth/me` | — |
| POST | `/api/track/visit` · `/track/view/:id` · `/track/contact` · GET `/api/stats` | public/admin |

---

## 🔐 Configurare (.env)

```bash
cp .env.example .env
```
```
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=parola-ta-buna
SESSION_SECRET=un-secret-lung-si-aleator   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Fără `.env` → valori implicite (`admin` / `admin`), bune doar pentru test.

## 🎨 Personalizare rapidă

- **Culori / branding**: variabilele CSS din `:root` (`public/assets/css/styles.css`) — ex. `--accent` (roșu Madrid).
- **Poză hero**: înlocuiește `public/assets/img/hero-madrid.svg` cu o poză royalty-free din Madrid (actualizează `.hero-bg` în `styles.css`).
- **Categorii/servicii**: se gestionează din **admin → Taxonomía** (nu mai sunt hardcodate). Sinonimele pentru importul din URL: `SERVICE_SYNONYMS` din `server/extract.js`.
- **Firme demo**: `server/seed.js`.

## ☁️ Deploy pe Vercel + Supabase

Aplicația rulează pe **Vercel** (serverless) cu persistență durabilă în **Supabase Postgres**.

**Cum funcționează:** baza de lucru e SQLite `:memory:` (toată logica din `server/db.js`, sincronă). La fiecare cold start se hidratează din Postgres; după fiecare scriere de admin, starea se salvează înapoi în Postgres. Astfel serverul e „fără stare" și rulează pe funcții serverless. Vezi `server/pgstore.js`.

Pașii:

1. **Supabase** → creează un proiect. Din *Project Settings → Database → Connection string* copiază varianta **Transaction pooler** (portul `6543`).
2. **Vercel** → *Project → Settings → Environment Variables*, adaugă:
   - `DATABASE_URL` = connection string-ul de la pasul 1 (cu parola ta)
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`
   - `SESSION_SECRET` = `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Deploy** (push pe `main` → Vercel build automat). La primul boot, aplicația creează singură tabelele (`CREATE TABLE IF NOT EXISTS`) și încarcă datele demo în Postgres. Schema de referință: `db/schema.sql`.

Note:
- **Fără `DATABASE_URL`**, site-ul tot pornește pe Vercel (datele din seed, în memorie), dar modificările din admin nu persistă între cold start-uri. Setează `DATABASE_URL` pentru persistență reală.
- **Imaginile**: pe serverless nu există disc → se stochează inline (`data:` URL) în DB, deci persistă în Postgres.
- **Local** (fără `DATABASE_URL`): folosește SQLite pe disc (`server/data.db`), exact ca înainte.

Rulează întotdeauna în spatele **HTTPS** (Vercel îl oferă implicit).
