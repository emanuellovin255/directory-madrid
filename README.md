# Profesionales Madrid (profesionalesmadrid.es)

Un **director web SEO-first pentru profesioniști din Comunitatea Madrid**: reformas, fontaneros, electricistas, climatización, cerrajeros, control de plagas, mudanzas și talleres. E **lead magnetul** pentru Listo247 (gestionarea fișei Google): firmele apar gratis, își revendică fișa și primesc oferta Listo247. Modern, profesional și **complet full-stack**, cu **pagini generate pe server (SSR)** optimizate pentru Google.

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
| `/buscar?q=…` · `/sitemap.xml` · `/robots.txt` | — | Căutare (noindex) + sitemap index pe tipuri + robots |
| `/profesionales` · `/profesionales/:categoria` | `/profesionales/fontaneros` | Pentru firme: alta gratis, caută-ți fișa, poveste gratuită, Listo247 |
| `/precios` · `/precios/:slug` | `/precios/precio-fontanero-madrid` | Prețuri orientative (12 pagini) |
| `/guias` · `/guias/:slug` | `/guias/licencia-de-obra-madrid` | Ghiduri pentru clienți (8) |
| `/historias` · `/historias/:slug` | — | Povești despre firme (lead magnet 2), scrise din admin |
| `/sobre-nosotros` · `/contacto` | — | Cum funcționează directorul · formular contact (corectare/ștergere fișă) |
| `/insignia/:id.svg` | — | Sigiliul „Verificado” pentru site-ul firmei (doar fișe verificate) |

### Reguli SEO (important)

- **Fișele de firmă** au `noindex,follow` până când au conținut propriu: revendicate și aprobate, sau cu descriere de minimum 150 de caractere (`DB.isIndexableBusiness`). Doar acestea intră în `sitemap-negocios-N.xml`.
- **Listările** (categorie × zonă / district / barrio / metro) sunt indexabile de la `MIN_LISTING` firme (implicit 3). Chipurile de linkuri interne arată doar paginile care trec pragul.
- **Sitemap-ul** e un index cu un sub-sitemap pe tip de pagină: `principales`, `servicios`, `distritos`, `municipios`, `barrios`, `metro`, `historias`, `negocios-N`. Cu `SITEMAP_TYPES` alegi ce grupuri publici (lansare în valuri).
- **Clienții nu văd telefonul nostru**, doar formulare. `PRO_PHONE` apare numai în secțiunile pentru profesioniști.
- Fișele verificate apar primele în ordinea automată (pozițiile fixate din admin au prioritate). „Destacado” se afișează ca **Patrocinado**.

### Fluxul de revendicare

Pe fiecare fișă nerevendicată apare blocul „¿Es tu negocio?”. Cererea ajunge în **admin → Leads → Reclamaciones**. Suni la telefonul din fișă ca s-o verifici, apoi apeși **„Aprobar y publicar”**: descrierea se publică, fișa primește ✓ și devine indexabilă. Codul insignei îl copiezi din editorul firmei. Ghidul de contactare a firmelor e în `docs/outreach.md`, iar procesul pentru povești în `docs/historias.md`.

### Scripturi

```bash
node scripts/export-profiles.js --sin-verificar --min-resenas=20 > fichas.csv   # CSV cu URL-ul fiecărei fișe (pentru GHL)
node scripts/enrich-from-web.js --limit=50              # simulare: adresă/orar/rețele din site-ul firmei
node scripts/enrich-from-web.js --limit=50 --apply      # salvează
node scripts/prune-outside.js                           # simulare: firmele din afara Comunității Madrid
node scripts/prune-outside.js --apply                   # le șterge (backup automat; cu DATABASE_URL → Supabase)
```

`prune-outside.js`: scraper-ul leadurilor potrivește nume de locuri „după ureche” („Salamanca” orașul → districtul Salamanca, „La Acebeda” → firme din Jaén). Se scot: telefon fix din altă provincie (91/81 = Madrid), mobil cu etichetă de zonă din afara Comunității, mobil într-o zonă unde majoritatea fixelor sunt din altă provincie. `import-leads.js` aplică aceeași regulă, deci un reimport nu le mai aduce înapoi.

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

### Import leaduri (CSV-uri GHL)

```bash
node scripts/import-leads.js "/cale/Contractors Madrid.zip" --dry-run   # simulare + raport
node scripts/import-leads.js "/cale/Contractors Madrid.zip"             # import real (backup automat al data.db)
```

- Importă **doar** nume firmă, telefon, web, zonă și nr. de reseñas; serviciul vine din numele fișierului (`Plagas_…csv` → Control de plagas).
- Aceeași firmă (nume + telefon) în mai multe CSV-uri = **un singur negocio** cu mai multe categorii.
- Zona (`Area`) → distrito/municipio (+ barrio dacă există); urbanizațiile rămân ca text (`El Montecillo · Las Rozas de Madrid`).
- Re-rulabil: firmele existente primesc doar categoriile lipsă (editările manuale nu se ating). Cu `DATABASE_URL` scrie direct în Supabase.
- Din admin completezi oricând: **responsable**, **nr. membri echipă**, **descriere**, logo/fotos, iar butonul **⌂ Portada** pune firma pe prima pagină (ordinea din *Orden / Clasamentos → Home*).
- **Orden / Clasamentos**: per nișă (± zonă/municipio) vezi paginile exact ca pe site (20/pagină) și fixezi orice firmă pe o **poziție absolută** (ex. nr. 45 = pagina 3); pozițiile libere se umplu automat. *Home* = Empresas destacadas: pagina 1 pe portadă (20), restul pe `/destacadas?page=N`.

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

Variabile noi (detalii în `.env.example` și `DEPLOY-VERCEL.md`): `SITE_URL`, `SITE_EMAIL`, `PRO_PHONE`, `MIN_LISTING`, `SITEMAP_TYPES`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`.

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
