# Directorio Dental Madrid

Un **director web pentru clinici dentare din Madrid** — modern, profesional și acum **complet real** (full-stack).
Persistență reală, login de admin adevărat, upload poze pe server și analytics real de vizitatori — **fără Supabase**,
totul local/self-hosted.

**Stack:** Node.js + Express + **SQLite** (`node:sqlite`, built-in — fără dependențe native). Conținut în spaniolă.

> ⚠️ Cele 3 clinici incluse sunt **demo/fictive** (telefoane/email/web `example`), în cartiere reale din Madrid.
> Le editezi/înlocuiești din panoul de admin.

---

## 🚀 Cum îl rulezi

Ai nevoie de **Node.js 22+** (ai deja v24). Din folderul proiectului:

```bash
npm install      # o singură dată
npm start        # pornește serverul
```

Apoi deschide **http://localhost:3000**

- Site public: `http://localhost:3000/`
- Login admin: `http://localhost:3000/login.html`
- Panou admin: `http://localhost:3000/admin.html` (redirecționează la login dacă nu ești autentificat)

Pentru dezvoltare cu reload automat: `npm run dev`.

---

## 🔐 Configurare (.env)

Credențialele și secretul de sesiune se pun într-un fișier `.env` (nu se comite):

```bash
cp .env.example .env
```

Apoi editează `.env`:
```
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=parola-ta-buna
SESSION_SECRET=un-secret-lung-si-aleator
```
Generează un secret bun:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Fără `.env`, se folosesc valori implicite (`admin` / `admin`) — bune pentru test, **schimbă-le pentru producție**.

---

## 🛠️ Ce poți face din admin

- **Login real** (sesiune pe cookie semnat) — rutele de scriere sunt protejate pe server.
- **Adaugă / editează / șterge** clinici (toate câmpurile: nume, poză, „sobre nosotros", servicii, orar, telefon, email, web, rețele sociale, zonă, adresă).
- **Încarcă poze** — se redimensionează pe client și se salvează **pe server** în `uploads/`.
- Marchează clinici ca **„destacada"**.
- **Exportar / Importar** JSON (backup / migrare).
- **Restaurar demo** (revine la cele 3 clinici seed).
- **Estadísticas reale**: vizitatori pe lună (grafic), fișe vizualizate, clicuri de contact, top clinici — agregate din baza de date.

---

## 📁 Structura

```
Directory/
├── server/
│   ├── server.js     # Express: static + API + auth + upload + analytics
│   ├── db.js         # SQLite (node:sqlite): schema + queries + agregări
│   ├── seed.js       # Populează demo la prima pornire (dacă DB e gol)
│   └── data.db       # Baza de date (se creează la rulare; în .gitignore)
├── public/           # Frontend servit de Express
│   ├── index.html    # Home (search + grid + modal)
│   ├── login.html    # Login admin
│   ├── admin.html    # Dashboard admin
│   └── assets/{css,js}
│       └── js/ ui.js · api.js · app.js · admin.js
├── uploads/          # Poze încărcate (în .gitignore, mai puțin .gitkeep)
├── .env.example      # Model de configurare
├── package.json
├── PLAN.md · README.md · tasks/
```

## 🌐 API (pe scurt)

| Metodă | Rută | Acces |
|--------|------|-------|
| GET | `/api/clinics`, `/api/clinics/:id` | public |
| POST/PUT/DELETE | `/api/clinics[/:id]` | admin |
| POST | `/api/clinics/:id/featured`, `/api/clinics/reset-demo` | admin |
| POST | `/api/upload` | admin |
| GET/POST | `/api/export` · `/api/import` | admin |
| POST | `/api/auth/login` · `/api/auth/logout` | — |
| GET | `/api/auth/me` | — |
| POST | `/api/track/visit` · `/api/track/view/:id` · `/api/track/contact` | public |
| GET | `/api/stats` | admin |

---

## 📊 Analytics real

Serverul înregistrează în baza de date fiecare **vizită** (o dată per sesiune, dedupe pe cookie), **vizualizare de fișă**
și **click de contact** (telefon/web). Panoul de statistici le agreghează pe lună. La prima pornire se seedează un istoric
demo ca graficul să arate bine; îl poți reseta din admin („Reiniciar datos demo").

## 🔒 Note de securitate

- Schimbă `ADMIN_PASSWORD` și `SESSION_SECRET` în `.env` pentru producție.
- Cookie de sesiune `httpOnly` + `sameSite=lax` (mitighează CSRF pentru un panou same-origin).
- În producție rulează în spatele **HTTPS** (ex. un reverse proxy) ca să protejezi cookie-ul și parola în tranzit.

## ☁️ Deploy (fără Supabase)

Se poate găzdui pe orice platformă cu Node: **Render, Railway, Fly.io, un VPS** etc.
- Setează variabilele din `.env` în panoul platformei.
- Pentru ca datele/pozele să persiste, atașează un **disc persistent** (pentru `server/data.db` și `uploads/`).

## 🎨 Personalizare rapidă

- **Culori / branding**: variabilele CSS din `:root` (`public/assets/css/styles.css`) — ex. `--accent`.
- **Servicii sugerate** (filtre + autocomplete admin): `DDM.SERVICE_CATALOG` din `public/assets/js/ui.js`.
- **Coloane grid**: media queries `.grid` din `styles.css` (implicit 6 desktop / 2 telefon).
- **Clinicile demo**: `server/seed.js`.
