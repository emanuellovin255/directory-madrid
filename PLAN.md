# PLAN — Directorio Dental Madrid

> **Stare:** Faza 1 (site static) ✅ + **Faza 2 (backend real) ✅**. Aplicația e acum full-stack
> (Node + Express + SQLite), fără Supabase. Vezi secțiunea „Faza 2" jos și `README.md` pentru rulare.

## Context
Director web pentru **clinici dentare din Madrid**: simplu, modern, profesional. Home cu **bară de
search**, listări în **grid (6 pe desktop / 2 pe telefon)**, **modal** cu toate detaliile la click,
plus un **dashboard de admin** (CRUD + statistici). Ca preview: **3 clinici demo** (fictive) în spaniolă.

**Decizii:** site **static** (HTML/CSS/JS, fără instalare, fără CDN), conținut în **spaniolă**,
persistență în **localStorage**, analytics **local/demo**. Backend real = pas următor (vezi README.md).

## Arhitectură
- `data.js` — seed (3 clinici) + catalog servicii + zile + generator placeholder SVG.
- `store.js` — strat localStorage: `getAll/get/add/update/remove/toggleFeatured/resetToSeed/exportJSON/importJSON`.
- `analytics.js` — contor vizite/views/contacte + serie lunară + grafic SVG nativ.
- `app.js` — home: grid, search live, filtre (zonă/serviciu), sortare, modal, deep-link `#clinica=slug`.
- `admin.js` — gate parolă, CRUD, upload foto cu resize, export/import, statistici.
- `styles.css` — design system (accent teal, carduri, modal, admin, chart).

## Model de date (o clinică)
`id, name, zone, address, about, services[], hours{7 zile}, phone, email, website,
social{instagram,facebook,twitter,tiktok,linkedin,youtube}, rating, reviews, featured, photo`

## Funcționalități livrate
- [x] Home: hero + **search live** + statistici
- [x] **Grid responsive** 6 / 4 / 3 / 2 coloane
- [x] Filtre **zonă** + **serviciu** + sortare (destacadas / rating / nume)
- [x] **Modal** detalii: foto, sobre nosotros, servicii, orar (evidențiază ziua curentă), contact, rețele
- [x] **Deep-link** `#clinica=slug` (partajabil, ca o pagină)
- [x] Admin **gate** (parolă client) + **CRUD** complet
- [x] **Upload foto** cu redimensionare pe client (data-URL în localStorage)
- [x] **Export / Import JSON** + **Restaurar demo**
- [x] **Statistici**: vizite/lună (grafic), fișe vizualizate, clicuri contact, top clinici
- [x] 3 clinici demo (Salamanca, Chamberí, Malasaña)

## Limitări conștiente (versiune statică)
- Date + poze în **localStorage** (fără sync între dispozitive) → mitigat cu export/import.
- Analytics **local/demo** (nu vizitatori reali agregați).
- Parola de admin **nu e securitate reală** (client-side).

---

## Faza 2 — Backend real (implementat, fără Supabase)

Aplicația a fost transformată din static în full-stack, **local/self-hosted**:

- **Node.js + Express** — servește `public/` + un API REST.
- **SQLite** prin `node:sqlite` (built-in Node 22+/24) — persistență reală într-un fișier (`server/data.db`), **fără dependențe native**. Tabele: `clinics`, `events`.
- **Login admin real** — `cookie-session` semnat, credențiale din `.env`, comparație `timingSafeEqual`, middleware `requireAuth` pe scriere. Pagină `login.html`; `admin.html` redirecționează dacă nu ești autentificat.
- **Upload poze pe server** — `POST /api/upload` (dataURL redimensionat pe client) scrie fișier în `uploads/`, salvează URL-ul.
- **Analytics real** — serverul înregistrează `visit`/`view`/`contact` în `events`; `GET /api/stats` agreghează pe lună (SQL). Vizite dedupe pe cookie de sesiune.
- **Frontend pe API** — module: `ui.js` (comun), `api.js` (fetch), `app.js` (home), `admin.js` (admin). Fără localStorage.

**Arhitectură fișiere:** `server/{server.js,db.js,seed.js}` + `public/{index,admin,login}.html` + `public/assets/js/{ui,api,app,admin}.js`.
Rulare: `npm install && npm start` → `http://localhost:3000` (detalii + `.env` + deploy în `README.md`).

**Limitările fazei 1 (static) sunt rezolvate:** date partajate între dispozitive (DB pe server), analytics real agregat, login real.

## Pași următori (opțional)
- HTTPS în producție (reverse proxy) + disc persistent pentru `data.db`/`uploads` la deploy.
- Curățare poze orfane la ștergerea unei clinici; token CSRF explicit; rate-limiting pe login.
- Pagină de detaliu dedicată (URL propriu) pe lângă modal; hartă; formular „Añade tu clínica".
